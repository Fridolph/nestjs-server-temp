import { z } from 'zod'

export const createUserSchema = z.strictObject({
	username: z.string().trim().min(1, '请输入用户名').max(20, '用户名最多 20 个字符'),
	password: z
		.string()
		.min(6, '密码至少 6 位')
		.max(32, '密码最多 32 个字符')
		.refine(value => [/[A-Za-z]/, /\d/, /[^A-Za-z0-9\s]/].filter(pattern => pattern.test(value)).length >= 2, {
			message: '密码不能只用数字或字母，请组合至少两类字符',
		}),
	roleIds: z
		.array(z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]))
		.min(1, '请至少选择一个角色')
		.refine(ids => new Set(ids).size === ids.length, '角色不能重复'),
	nickname: z
		.string()
		.trim()
		.min(1, '昵称不能为空')
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

export type CreateUserDto = z.output<typeof createUserSchema>
