import { z } from 'zod'

export const registerSchema = z.strictObject({
	username: z.string(),
	password: z.string(),
})

export type RegisterDto = z.output<typeof registerSchema>
