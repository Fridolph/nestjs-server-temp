import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { signinSchema } from './dto/signin.dto.ts'

@Injectable()
export class RegisterPipe implements PipeTransform {
	transform(value: any, metadata: ArgumentMetadata) {
		return {
			username: String(value?.username).trim(),
			password: String(value?.password),
			roles: value.roles ?? [3],
		}
	}
}

export const SigninPipe = new ZodValidationPipe(signinSchema)
