# Profile 请求校验模板

当前使用项目已有的 Zod 4 和自定义 `ZodValidationPipe`，保留 Nest 12。
本次查询到的 `nestjs-zod@5.5.0` 仅声明支持 Nest 10/11，因此没有安装该包。

## 文件与数据流

- `../dto/update-profile.dto.ts`：集中定义 Schema，并推导输入类型和 `UpdateProfileDto`，无需 DTO class。
- `../../common/pipes/zod-validation.pipe.ts`：执行校验，将错误转换成 HTTP 400，返回转换后的数据。
- `profile.controller.ts`：为 PATCH 请求显式绑定 Schema，转换路径中的整数 ID，并将通过校验的请求交给 Service。
- `profile.service.ts`：调用资料仓库，组装业务响应。
- `profile.repository.ts`：提供 TypeORM 与参数化 SQL 两种实现；当前 Service 调用 TypeORM 版本。

```text
PATCH /api/v1/users/18/profile
  → ParseIntPipe 校验路径整数，ZodValidationPipe 校验请求体
  → 得到去除昵称首尾空白后的 DTO
  → ProfileService 调用 ProfileRpst.updateProfile
  → Repository 挑选非 undefined 的白名单字段
  → 数据库执行 UPDATE
```

Profile PATCH 与创建用户接口已分别绑定自己的 Zod Schema。复制到新接口时，应定义对应 Schema，再通过 `@Body(new ZodValidationPipe(schema))` 绑定；仅给参数标注 TypeScript 类型不会执行校验。

## 手动验收

| PATCH 请求体                           | 预期                                   |
| -------------------------------------- | -------------------------------------- |
| `{ "address": "未知领地" }`            | 只更新地址，不改变昵称                 |
| `{ "nickname": "  小明  " }`           | 服务收到的昵称是 `小明`                |
| `{ "gender": 0, "photo": null }`       | 保留数字 0，并允许清空照片             |
| `{ "nickname": null }`                 | HTTP 400                               |
| `{ "nickname": "   " }`                | HTTP 400                               |
| `{ "gender": "1" }`                    | HTTP 400，不自动将字符串转换成数字     |
| `{ "userId": 19, "nickname": "小明" }` | HTTP 400，拒绝修改请求契约之外的字段   |
| `{}`                                   | HTTP 400，必须提供至少一个有效更新字段 |

Pipe 抛出的异常包含 `statusCode`、`message` 与 `errors`，每个错误提供 `path`、`code`、`message`。请求体整体错误的路径使用 `$`。全局 `AllExceptionFilter` 将其统一为 `code`、`msg`、`timestamp`、`path`，并保留公开的 `errors` 字段；客户端不接收原始输入、SQL 和内部堆栈。

## 下一轮作业

1. 已补充两个更新版本的存在性判断：零影响行数时复查资料，确实不存在返回 404，原值重复提交仍成功。用户停用时能否更新仍待确定。
2. 已实现昵称格式限制：昵称去除首尾空白后只允许中文、英文字母、数字和下划线。当前已移除提前查重，依赖数据库唯一约束。
3. 实体已声明昵称唯一，过滤器按重复键返回 HTTP 409 和通用冲突提示；实际数据库唯一约束需单独验收，数据库变更另行确认。
4. 检查注册时用用户名初始化昵称的长度与唯一性规则。
5. 补充身份与权限检查，确保只能修改自己或获授权的用户资料。

普通事务无法代替唯一索引解决并发竞争。单条 UPDATE 暂不需要显式事务；未来需要同时完成多条写入时，再设计事务边界。资料查询里的 NotFoundException 只作用于查询入口，不会自动让更新具备存在性校验，因此两个更新实现都需要处理零影响行数。

## Repository 分层复盘

- Controller 绑定 Pipe 并接收 HTTP 参数，Service 负责业务编排与响应，Repository 封装查询和持久化细节。
- 当前创建仓库持有跨 user、users_roles、profile 的事务，所有操作沿用同一个 manager，事务没有因抽文件而被拆散。
- Repository 返回实体、查询行或影响行数，删除与更新响应统一由 Service 组装。
- Service 已移除重构前未使用的 TypeORM 仓库注入，数据库访问集中在 Repository。
- TypeORM 与 SQL 版本用于学习对照可以保留，但字段、空值语义、存在性判断和返回结构应保持一致。

## 运行模板测试

```bash
pnpm test
```

测试覆盖 Pipe、查询分页、资料部分更新、角色分配、Service 响应和全局错误协议，使用隔离的数据访问替身，不连接真实数据库。真实数据库的事务回滚和外键、唯一约束仍需另行验收。
