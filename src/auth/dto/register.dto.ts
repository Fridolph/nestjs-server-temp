import { z } from 'zod'

export const registerInputSchema = z.strictObject({
	username: z.string().trim().min(4, '至少输入 4 个字符的用户名').max(20, '用户名最多 20 个字符'),
	password: z
		.string()
		.min(6, '密码至少 6 位')
		.max(32, '密码最多 32 个字符')
		.refine(
			value =>
				[/[A-Za-z]/, /\d/, /[^A-Za-z0-9\s]/].filter(pattern => pattern.test(value)).length >= 2,
			{
				message: '密码不能只用数字或字母，请组合至少两类字符',
			}
		),
})
export type RegisterInputDto = z.output<typeof registerInputSchema>

export const registerOutputSchema = z.strictObject({
	userId: z.number(),
	username: z.string(),
	accessToken: z.string(),
	tokenType: z.literal('Bearer'),
	roleIds: z.array(z.number()),
})
export type RegisterResponseDto = z.output<typeof registerOutputSchema>
