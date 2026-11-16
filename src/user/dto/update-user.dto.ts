import { z } from 'zod'
import { updateProfileSchema } from './update-profile.dto.ts'

/** 管理后台用户编辑：资料、联系方式与单个非超管角色可在一个事务内更新。 */
export const updateUserSchema = z.strictObject({
	phone: z.union([z.string().regex(/^1[3-9]\d{9}$/, '请输入有效的 11 位手机号'), z.null()]).optional(),
	email: z.union([z.email('请输入有效的邮箱地址').max(120), z.null()]).optional(),
	roleCode: z.enum(['admin', 'user', 'premium', 'guest']).optional(),
	profile: updateProfileSchema.optional(),
}).refine(value => Object.values(value).some(item => item !== undefined), '至少提供一个可更新字段')

export type UpdateUserInputDto = z.output<typeof updateUserSchema>
