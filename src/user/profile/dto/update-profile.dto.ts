import { z } from 'zod'

/**
 * 定义资料 PATCH 请求的可更新字段、空值语义和长度限制。
 *
 * @remarks
 * 未提供的字段保持原值；昵称不允许清空，其他资料字段允许显式传入 null。
 * 昵称会先去除首尾空白，唯一性和用户权限由业务层与数据库保证。
 */
export const updateProfileSchema = z
	.strictObject({
		nickname: z
			.string({ error: '昵称必须是字符串，不能为 null' })
			.trim()
			.min(1, '昵称不能为空或纯空白')
			.max(20, '昵称最多 20 个字符')
			.regex(/^[A-Za-z0-9_\p{Script=Han}]+$/u, '昵称只能包含中文、英文字母、数字和下划线')
			.optional(),
		gender: z
			.union([z.literal(0), z.literal(1)])
			.nullable()
			.optional(),
		photo: z.string().max(512, '照片地址最多 512 个字符').nullable().optional(),
		address: z.string().max(120, '地址最多 120 个字符').nullable().optional(),
	})
	.refine(payload => Object.values(payload).some(value => value !== undefined), {
		message: '至少提供一个可更新字段',
	})

/** 资料更新请求在执行校验和转换前的类型。 */
export type UpdateProfileInput = z.input<typeof updateProfileSchema>

/** 资料更新请求在执行校验和转换后的类型。 */
export type UpdateProfileDto = z.output<typeof updateProfileSchema>
