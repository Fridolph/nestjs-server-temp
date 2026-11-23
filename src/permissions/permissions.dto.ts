import { z } from 'zod'
import { CaslAction } from '../common/constants/casl.ts'

/** null 明确表示不限制字段；空数组、缺失值和重复字段均拒绝，避免错误配置扩大授权。 */
export const permissionFieldsSchema = z
	.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/))
	.min(1)
	.refine(fields => new Set(fields).size === fields.length, '授权字段不能重复')
	.nullable()

/** 仅选择构建 Ability 所需的列，不能用完整 Entity DTO 断言部分查询结果。 */
export const effectivePermissionSchema = z.strictObject({
	code: z.string().min(1).max(64),
	resource: z.string().min(1).max(64),
	action: z.enum(CaslAction),
	fields: permissionFieldsSchema,
})
export type EffectivePermission = z.output<typeof effectivePermissionSchema>

/** 权限目录允许的普通动作；manage 只由服务端超管 Ability 生成，不能写入目录。 */
export const permissionActionSchema = z.enum([
	CaslAction.Create,
	CaslAction.Read,
	CaslAction.Update,
	CaslAction.Delete,
	CaslAction.Export,
])

const permissionCodeSchema = z
	.string({ error: '权限编码必须是字符串' })
	.trim()
	.min(3, '权限编码至少 3 个字符')
	.max(64, '权限编码最多 64 个字符')
	.regex(/^[a-z][a-z0-9._-]*:[a-z][a-z0-9._-]*$/, '权限编码格式应为 resource:action')
const permissionResourceSchema = z
	.string({ error: '资源标识必须是字符串' })
	.trim()
	.min(1, '资源标识不能为空')
	.max(64, '资源标识最多 64 个字符')
	.regex(/^[a-z][a-z0-9._-]*$/, '资源标识只能使用小写字母、数字、点、下划线和短横线')
const permissionNameSchema = z
	.string({ error: '权限名称必须是字符串' })
	.trim()
	.min(1, '权限名称不能为空')
	.max(64, '权限名称最多 64 个字符')

/** 创建权限目录记录；fields 为 null 表示不限制字段。 */
export const createPermissionSchema = z.strictObject({
	code: permissionCodeSchema,
	name: permissionNameSchema,
	resource: permissionResourceSchema,
	action: permissionActionSchema,
	enabled: z.boolean().default(true),
	fields: permissionFieldsSchema.optional().default(null),
})

/** 更新权限目录记录；权限编码是角色关联使用的稳定标识，不允许修改。 */
export const updatePermissionSchema = z
	.strictObject({
		name: permissionNameSchema.optional(),
		resource: permissionResourceSchema.optional(),
		action: permissionActionSchema.optional(),
		enabled: z.boolean().optional(),
		fields: permissionFieldsSchema.optional(),
	})
	.refine(payload => Object.values(payload).some(value => value !== undefined), {
		message: '至少提供一个可更新字段',
	})

export type CreatePermissionInput = z.input<typeof createPermissionSchema>
export type CreatePermissionDto = z.output<typeof createPermissionSchema>
export type UpdatePermissionInput = z.input<typeof updatePermissionSchema>
export type UpdatePermissionDto = z.output<typeof updatePermissionSchema>

/** 权限目录的内部数据；时间为 Date，HTTP 序列化后为字符串。 */
export const permissionSchema = effectivePermissionSchema.extend({
	id: z.number().int().positive(),
	name: z.string().min(1).max(64),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
})
export type PermissionDto = z.output<typeof permissionSchema>

/** 按资源聚合后的管理端目录；permissions 仍保留逐动作明细。 */
export interface PermissionGroup {
	resource: string
	name: string
	actions: CaslAction[]
	permissions: PermissionDto[]
}
