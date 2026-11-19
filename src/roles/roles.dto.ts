import { z } from 'zod'

const roleCode = z
	.string({ error: '角色编码必须是字符串' })
	.trim()
	.min(1, '角色编码不能为空')
	.max(32, '角色编码最多 32 个字符')
	.regex(/^[a-z][a-z0-9_]*$/, '角色编码只能包含小写字母、数字和下划线')
const roleName = z
	.string({ error: '角色名称必须是字符串' })
	.trim()
	.min(1, '角色名称不能为空')
	.max(32, '角色名称最多 32 个字符')
const description = z
	.string({ error: '角色描述必须是字符串' })
	.trim()
	.max(255, '角色描述最多 255 个字符')

/** 角色展示字段，授权编码与数据库 code 列对应。 */
export const roleSchema = z.strictObject({
	roleId: z.number().int().positive(),
	roleName,
	description,
	roleCode,
})
/** 创建时拒绝未声明字段；super_admin 保留编码由仓库单独保护。 */
export const createRoleSchema = z.strictObject({ roleName, description, roleCode })
/** PATCH 只接受名称和描述，拒绝空更新、null 和授权编码修改。 */
export const updateRoleSchema = z
	.strictObject({
		roleName: roleName.optional(),
		description: description.optional(),
	})
	.refine(payload => Object.values(payload).some(value => value !== undefined), {
		message: '至少提供一个可更新字段',
	})

/**
 * 用于权限判断的角色编码。
 */
export const roleCodeSchema = z.enum(['super_admin', 'admin', 'user', 'premium', 'guest'])

export type RoleCode = z.output<typeof roleCodeSchema>

export type RoleType = z.output<typeof roleSchema>
export type QueryRoleDto = z.output<typeof roleSchema>
export type CreateRoleInput = z.input<typeof createRoleSchema>
export type CreateRoleDto = z.output<typeof createRoleSchema>
export type UpdateRoleInput = z.input<typeof updateRoleSchema>
export type UpdateRoleDto = z.output<typeof updateRoleSchema>
