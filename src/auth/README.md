# 登录、续期与登出

## 会话模型

每次登录/注册建立一条 `auth_sessions`。access JWT 有效 15 分钟，包含 `sid`；refresh token 是高熵随机字符串，只通过 HttpOnly Cookie 下发，数据库仅存 SHA-256 摘要。会话绝对有效期 7 天，续期不延长。

```text
登录/注册 → 校验身份 → 建立数据库会话 → access JWT + refresh Cookie
业务请求 → JwtGuard 验签/期限 → 查询有效会话及启用用户 → CASL 授权
access 过期 → refresh Cookie → 事务行锁 → 轮换摘要/Cookie → 新 access JWT
登出 → 撤销当前会话 → 清 Cookie → 前端清身份/权限/缓存
```

JWT 自身无法被“删除”。旧 JWT 仍可验签，但 Passport 每次都查会话，撤销事务提交后的下一次鉴权返回 401。已经通过鉴权的在途业务不会被中途取消。其他设备会话不受影响。旧版不含 sid 的 JWT 需重新登录。

## 分层与接口

- `AuthController`：HTTP 参数、Cookie、响应状态。
- `AuthService`：凭据校验、注册与会话编排。
- `AuthSessionService`：签发、续期、验会话与退出。
- `AuthSessionRepository`：会话持久化及 refresh 行锁事务。
- `JwtStrategy`：验签通过后查有效会话；授权仍交给 CASL Guard。

接口前缀沿用配置，默认 `/api/v1`：

| POST 路径 | 输入 | 成功行为 |
| --- | --- | --- |
| `/auth/signin` | username/password | 建立会话，返回 access token，设置 Cookie |
| `/auth/register` | 注册白名单 | 固定普通用户，创建后自动登录 |
| `/auth/refresh` | refresh Cookie | 轮换 Cookie，返回新 access token |
| `/auth/logout` | refresh Cookie 和/或 Bearer | 幂等撤销，清 Cookie，返回 200 |

所有认证写接口需 `X-Auth-Request: 1`，浏览器 Origin 按 `AUTH_ALLOWED_ORIGINS` 校验，配置 `*` 时允许任意来源；Apifox/curl 也需添加该头。logout 不使用 JwtGuard，允许过期但签名有效的 access token 撤销会话。

业务请求 401 时前端尝试续期一次；续期 401 才回登录。403 是已认证但权限不足，不登出。数据库/网络故障不能当成凭据失效，不清 Cookie。

## 并发、安全与配置

refresh 在同一事务锁住会话并比较旧摘要，成功后轮换；旧 refresh 重放则撤销整个会话。撤销结果在事务提交后才转为 401，避免抛异常回滚撤销。前端单标签页合并续期，并用 Web Locks 串行同源多标签页轮换。轮换响应若在网络中丢失，客户端可能需要重新登录，这是严格重放检测的取舍。

Cookie 固定 HttpOnly、SameSite=Lax，路径为 `/<PREFIX>/<VERSION>/auth`；生产 Secure。认证响应 `Cache-Control: no-store`。认证写接口与 CORS 共用来源配置，CORS 开启 credentials。日志不记录完整请求头、令牌和响应体。

未配置时，开发默认允许 localhost/127.0.0.1 的 3000 和 3050 端口；生产必须显式配置。允许任意来源：

```dotenv
AUTH_ALLOWED_ORIGINS=*
```

`*` 会同时放开 CORS 和认证写接口的 Origin 校验，表示信任所有网站。由于携带 Cookie，响应头会回显具体请求 Origin，并设置 `Vary: Origin`，不会返回 `Access-Control-Allow-Origin: *`。浏览器的 SameSite 与第三方 Cookie 策略仍生效，放开 CORS 不代表跨站请求一定携带 Cookie。

如需限制来源：

```dotenv
AUTH_ALLOWED_ORIGINS=https://admin.example.com
```

多个 origin 用英文逗号分隔，不带路径或末尾斜杠。生产仍需现有 SECRET、数据库及服务端口配置，使用 HTTPS。同源 Nuxt `/api/v1` 代理需指向部署环境真实后端；本例默认目标仅适用于本机开发。

## 迁移与验证

新增 `1795478400000-auth_sessions.ts`，不改既有用户表数据。本轮已执行。新环境先运行：

```sh
npm run migration:run
npm test
npm run build
```

HTTP 测试使用真实 Nest/Passport/JWT 和持久化替身，验证 Cookie、JWT 过期、退出、其他设备隔离、refresh 重放、停用用户与 CSRF。真实 MySQL 联调另验证了事务轮换/重放撤销，以及 HTTP 退出后旧 JWT 和 refresh 返回 401；临时测试账号测试后删除。

手工验收：登录后刷新仍有效；未登录访问带 query/hash 的后台地址，登录后回原位置；打开两个同源标签页，退出后两边回登录；403 留在当前页显示无权限。浏览器调试中 refresh Cookie 应为 HttpOnly，且没有可读 access_token Cookie。

本轮浏览器已验证桌面 1440×1000 与移动端 390×844 的登录/退出，刷新恢复会话、分页回跳和双标签页同步退出。通过拦截一次列表请求模拟 access 失效，验证真实 refresh 与重试成功；这项浏览器检查不等待 15 分钟，JWT 自然过期由 HTTP 自动化测试覆盖。

用户、菜单和资料接口统一先执行 JwtGuard。用户创建/编辑/删除要求管理员身份；资料 PATCH 仅允许本人或超管。真实数据库与 HTTP 联调验证了普通用户创建返回 403、管理员创建成功、数组角色参数返回 400、禁止分配超管、角色变化后旧 JWT 按最新角色授权，以及退出后列表/菜单/资料操作返回 401。联调用临时账号，不修改现有账号密码。

## 后续生产工作

当前每次鉴权查询数据库，便于解释且确保跨实例撤销一致；后续若加 Redis 缓存，必须同时设计撤销一致性。此轮未实现所有设备退出、设备管理、过期会话定期清理、登录限流与完整审计；上线前按真实运维与风控需求补充。新登录会建立新会话，旧会话会在退出或 7 天到期后失效。

## 单角色约定

用户通过 `user.roleId`（非空外键）关联唯一角色；角色对用户为一对多，角色对权限仍是多对多。创建用户请求、登录/注册/续期响应的 `roleId` 都是 number；用户列表返回 `roleId/roleCode`，不再返回 `roles` 数组。前端创建抽屉同步为单选。注册角色由后端按 `code=user` 查询，创建接口仍禁止分配超管。

创建请求使用 `{"username":"learner","password":"learn!123","roleId":3}`；不再接收 `roleIds: [3]`。自助注册不接受任何角色字段。用户列表和资料查询返回 `roleId: 3`；SQL 与 TypeORM 资料查询共用 `UserProfileRow` 类型。批量用户查询仍返回记录数组，每条记录的 roleId 都是 number。

`1795478400001-user_single_role.ts` 先检查每个用户恰好一个角色，复制关联后才删除旧中间表。遇到多角色或无角色数据时在任何 DDL 前退出，由维护者先明确数据处理策略。MySQL DDL 不保证整段回滚，执行时应停止业务写入并保留备份；down 会恢复当前单角色映射，不会找回迁移前人工舍弃的额外角色。

本轮两份迁移均已执行；用户 25 原有 admin/user 两项关联，经 Owner 确认保留 admin，其余既有用户角色保持原值。迁移前关联另有本机备份。
