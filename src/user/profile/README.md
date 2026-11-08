# Profile 请求校验模板

当前使用项目已有的 Zod 4 和自定义 `ZodValidationPipe`，保留 Nest 12。
本次查询到的 `nestjs-zod@5.5.0` 仅声明支持 Nest 10/11，因此没有安装该包。

## 文件与数据流

- `../dto/update-profile.dto.ts`：集中定义 Schema，并推导输入类型和 `UpdateProfileDto`，无需 DTO class。
- `../../common/pipes/zod-validation.pipe.ts`：执行校验，将错误转换成 HTTP 400，返回转换后的数据。
- `profile.controller.ts`：为 PATCH 请求显式绑定 Schema，并转换路径中的整数 ID。
- `profile.service.ts`：继续使用字段白名单构造原生 SQL，只更新提供的字段。

```text
PATCH /api/v1/users/18/profile
  → ParseIntPipe 校验路径整数，ZodValidationPipe 校验请求体
  → 得到去除昵称首尾空白后的 DTO
  → ProfileService 生成动态 SET 与值参数
  → 数据库执行 UPDATE
```

此模板只在 Profile PATCH 请求体上启用 Zod，不影响其他接口。复制到新接口时，应定义对应 Schema，再通过 `@Body(new ZodValidationPipe(schema))` 绑定；仅给参数标注 TypeScript 类型不会执行校验。

## 手动验收

| PATCH 请求体                           | 预期                                   |
| -------------------------------------- | -------------------------------------- |
| `{ "address": "未知领地" }`            | 只更新地址，不改变昵称                 |
| `{ "nickname": "  小明  " }`           | 服务收到的昵称是 `小明`                |
| `{ "gender": 0, "photo": null }`       | 保留数字 0，并允许清空照片             |
| `{ "nickname": null }`                 | HTTP 400，错误路径为 `nickname`        |
| `{ "nickname": "   " }`                | HTTP 400                               |
| `{ "gender": "1" }`                    | HTTP 400，不自动将字符串转换成数字     |
| `{ "userId": 19, "nickname": "小明" }` | HTTP 400，拒绝修改请求契约之外的字段   |
| `{}`                                   | HTTP 400，必须提供至少一个有效更新字段 |

校验失败时响应包含 `statusCode`、`message` 与 `errors`，每个错误提供 `path`、`code`、`message`。请求体整体错误的路径使用 `$`。

## 下一轮作业

1. 在 Service 中检查资料存在性，并明确用户停用时能否更新。
2. 已实现昵称格式限制与提前查重：昵称去除首尾空白后只允许中文、英文字母、数字和下划线；查重排除当前用户，未提供昵称时跳过查重。
3. 检查已有数据，再设计昵称唯一索引及其冲突到 HTTP 409 的映射。数据库变更另行确认。
4. 检查注册时用用户名初始化昵称的长度与唯一性规则。
5. 补充身份与权限检查，确保只能修改自己或获授权的用户资料。

昵称格式限制与提前查重已实现，其余业务规则仍待完善。查重发现其他用户使用相同昵称时返回 HTTP 409；普通事务无法代替唯一索引解决并发竞争。单条 UPDATE 暂不需要显式事务；未来需要同时完成多条写入时，再设计事务边界。

## 运行模板测试

```bash
pnpm exec vitest run src/user/__tests__/ src/common/pipes/__tests__/zod-validation.pipe.spec.ts
```

测试不连接数据库。真实应用中仍需配合业务校验和数据库约束。
