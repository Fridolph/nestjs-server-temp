import { z } from 'zod'
import { createUserSchema } from '../../user/dto/create-user.dto.ts'

/** 自助注册复用用户字段校验，角色由后端决定，额外字段直接拒绝。 */
export const signinSchema = z.strictObject(
	createUserSchema.pick({
		username: true,
		password: true,
	}).shape
)

export type SigninDto = z.output<typeof signinSchema>
