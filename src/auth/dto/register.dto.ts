import { z } from 'zod'
import { createUserSchema } from '../../user/dto/create-user.dto.ts'

/** 自助注册只接收用户名、密码和可选昵称，角色由服务端固定分配。 */
export const registerInputSchema = createUserSchema.pick({
	username: true,
	password: true,
	nickname: true,
})
export type RegisterInputDto = z.output<typeof registerInputSchema>

export const registerOutputSchema = z.strictObject({
	userId: z.number(),
	username: z.string(),
	accessToken: z.string(),
	tokenType: z.literal('Bearer'),
	roleId: z.array(z.number()),
})
export type RegisterResponseDto = z.output<typeof registerOutputSchema>
