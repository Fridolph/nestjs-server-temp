# CASL 权限实验

当前链路：JWT → CaslGuard → 当前用户/角色 → 有效权限 → 资源注册表 → Ability → 策略与字段检查。

## 资源注册

Entity 使用 `@CaslResource({ name, label, actions, fields })` 声明授权词汇。`CaslResourceRegistry` 在启动时读取 TypeORM 已加载的 Entity，跳过中间表，拒绝重复名称和保留名称 `all`。不需要在中央映射中添加 import。

- `name` 是稳定业务标识，与权限表 `resource` 精确一致；不是 Controller 路径前缀。
- `label` 是资源中文展示名，不参与授权；缺省时目录回退为资源编码。
- `actions` 限定该资源支持的普通动作；`manage` 只由可信超管分支生成。
- `fields` 限定可逐字段授权的业务字段，不自动包含所有数据库列。
- 注册资源不等于授予权限。增加 Entity 后仍需权限目录记录、角色关联以及业务检查入口。
- 权限编码 `code` 用于展示与分配；不能靠解析编码绕过 resource/action/fields 校验。

资源现值：`logs`、`users`、`profile`、`roles`、`menus`、`permissions`。

## 权限目录展示契约

`GET /permissions` 返回按资源分组的完整目录，仅超管可访问。每组包含
`resource`、资源展示名 `name`、去重的 `actions` 和逐条 `permissions`。
`actions` 表示已配置动作（含停用项），并非当前用户已获得的动作。

例如两条日志权限会显示为一组：

```json
{
  "code": 200,
  "data": [{
    "resource": "logs",
    "name": "系统日志",
    "actions": ["read", "export"],
    "permissions": [
      { "id": 1, "code": "log:read", "name": "系统日志读取", "resource": "logs", "action": "read", "fields": null, "enabled": true },
      { "id": 2, "code": "log:export", "name": "系统日志导出", "resource": "logs", "action": "export", "fields": ["path"], "enabled": false }
    ]
  }]
}
```

示例省略每条明细的 createdAt/updatedAt。数据库仍逐动作存储，单条权限继续按 ID 编辑/删除；
Service 分组，Repository 读取并排序，不使用会丢失明细的 SQL GROUP BY。
`/permissions/me` 和 `/permissions/:userId` 仍返回扁平有效权限，CASL 构建规则不使用分组目录。

本次目录响应结构有变化，前后端需配套更新。当前不分页；后续分页需以资源为单位，避免拆散同组明细。
角色授权 CheckboxGroup、批量创建及审计另作后续阶段，本轮没有新增这些写入接口。

## 数据库准备

保持已经执行的历史迁移不变。本次新增 `1795172400000-permission_fields.ts`，由 Owner 检查后执行：

```sh
pnpm run migration:run
```

本轮自动验证没有连接数据库，也没有执行迁移。新增迁移会在列不存在时添加 nullable JSON；已有 JSON 列保留；已有文本列先验证全部值为合法数组，再转换 JSON。不能解析的逗号文本、空数组和重复字段会阻止迁移，不会猜测或清空已有配置。回退保留列与数据，转成 longtext。

如果数据库已手动修改过字段，请先核对 migration:run 的全部待执行迁移，避免重复执行其他历史 DDL。

普通管理员的示例记录：

| code               | resource | action | fields                 | enabled |
| ------------------ | -------- | ------ | ---------------------- | ------- |
| log:read           | logs     | read   | SQL NULL               | 1       |
| log:export         | logs     | export | SQL NULL               | 1       |
| profile:edit-basic | profile  | update | `["nickname","photo"]` | 1       |

`fields` 的 SQL NULL 表示不限字段；JSON 数组表示字段集合。缺失列、JSON null、空数组、重复字段、未知字段和非法 JSON 均不退化为不限字段。显式的无字段限制规则会覆盖同资源同动作的局部字段限制，因此不要同时分配两者后期待局部限制缩小授权。

角色仍是多对多。角色由 `users_roles(userId, roleId)` 关联，权限由 `roles_permissions(roleId, permissionId)` 关联。注册时固定普通用户、超管角色分配保护沿用已有业务。

`super_admin` 来自数据库当前角色编码，生成 `manage/all`；普通角色即使被关联权限表的 `all/manage` 记录也会报权限配置错误（HTTP 500），不会提权。配置错误与正常缺少权限（403）分开。

## 手动请求

先通过 `/auth/signin` 获取各用户自己的 JWT，所有请求带 `Authorization: Bearer <token>`。以下路径前加项目的全局前缀，默认通常是 `/api/v1`，以环境配置为准。

| 方法与路径                              | 预期                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| GET `/permissions/me`                   | 当前有效用户授权，普通无权限用户得到空数组；超管得到 all/manage 标识 |
| GET `/permissions/test/logs/read`       | 要求 Logs read                                                       |
| GET `/permissions/test/logs/export`     | 要求 Logs export                                                     |
| GET `/permissions/test/logs/delete`     | 要求 Logs delete；无实际删除                                         |
| POST `/permissions/test/profile/update` | 要求 Profile update，并检查实际提交的每个字段；HTTP 200，无实际更新  |
| GET `/permissions`                      | 仅超管；按资源分组读取完整权限目录                                  |
| GET `/permissions/:userId`              | 仅超管；读取目标用户授权；目标 ID 不影响当前请求身份                  |
| POST `/permissions`                     | 仅超管；创建权限目录记录并校验 resource/action/fields 与 CASL 注册表一致 |
| PATCH `/permissions/:id`                | 仅超管；更新名称、资源、动作、启用状态或字段范围，code 保持不变      |
| DELETE `/permissions/:id`               | 仅超管；仅允许删除未被角色关联的权限，已关联返回 409              |

测试 Profile：只分配示例的 `profile:edit-basic`，不要同时分配不限制字段的 profile/update。

```json
{ "nickname": "新昵称", "photo": null }
```

应返回 200。提交 `{"nickname":"新昵称","address":"地址"}` 返回 403；提交 Zod 未声明的 `password` 返回 400。

| 身份                   | 读日志 | 导出日志 | 删除测试 |
| ---------------------- | ------ | -------- | -------- |
| 超管                   | 200    | 200      | 200      |
| 管理员，仅 read/export | 200    | 200      | 403      |
| 无相关权限用户         | 403    | 403      | 403      |
| 无 Token / Token 无效  | 401    | 401      | 401      |

撤销关联或禁用 export 后，同一个旧 JWT 的下一请求应变为 403。用户停用返回 403，用户删除后返回 404。授权 Promise 仅在同一请求中复用，不在不同请求间缓存，因此重新查询当前数据库配置。

## 边界与后续作业

- 本轮接入 `/permissions` 实验与 LogsController；其他现有业务路由的 AdminGuard 等策略没有全面替换。
- 字段规则不会自动裁剪 SQL、响应或请求体。实际更新业务应在写入前调用 `assertUpdateFields`，读取业务则需输出字段投影。本轮 Profile 接口只是授权实验，不修改真实资料，也没有替代现有 Profile 更新业务。
- 当前测试不包含数据范围条件。后续要在 Service 中加载可信记录，再检查条件，并把范围落实到 Repository 查询和更新，不能信任请求体的所属用户或部门。
- 类与方法策略合并为 AND；不要在整个 Controller 上统一声明 read 后，又期待 export 方法只需要 export。
- 同一方法可重复使用 Can，策略追加不覆盖；Cannot 表示检查缺少权限，不表示建立禁止规则。
- 挂 CaslGuard 却没有策略时默认 403；`/me` 通过显式 `CheckPolicies(() => true)` 表示只要求当前有效身份。
- createdAt/updatedAt 不等于授权变更审计。本轮不增加角色分配接口、审计、缓存或单角色迁移。
