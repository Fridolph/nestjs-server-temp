import { Injectable } from '@nestjs/common'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { signinSchema } from './dto/signin.dto.ts'
import { registerInputSchema } from './dto/register.dto.ts'

/** 保留教程中的命名管道入口；注册角色统一由业务层分配，不在 Pipe 中补角色。 */
@Injectable()
export class RegisterPipe extends ZodValidationPipe<typeof registerInputSchema> {
	constructor() {
		super(registerInputSchema)
	}
}

export const SigninPipe = new ZodValidationPipe(signinSchema)
