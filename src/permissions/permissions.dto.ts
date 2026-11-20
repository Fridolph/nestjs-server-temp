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

/** 权限目录的内部数据；时间为 Date，HTTP 序列化后为字符串。 */
export const permissionSchema = effectivePermissionSchema.extend({
	id: z.number().int().positive(),
	name: z.string().min(1).max(64),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
})
export type PermissionDto = z.output<typeof permissionSchema>
