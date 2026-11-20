import { registerInputSchema, type RegisterInputDto } from './dto/register.dto.ts'
import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service.ts'
import { signinSchema, type SigninDto } from './dto/signin.dto.ts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	/** 校验注册参数后创建用户及其默认资料。 */
	@Post('/register')
	async register(@Body(new ZodValidationPipe(registerInputSchema)) dto: RegisterInputDto) {
		const data = await this.authService.register(dto)
		return { code: 200, data, msg: '注册新用户' }
	}

	/** 校验登录参数，返回访问令牌。 */
	@Post('/signin')
	async signin(@Body(new ZodValidationPipe(signinSchema)) dto: SigninDto) {
		const data = await this.authService.signin(dto.username, dto.password)
		return { code: 200, data, msg: '登录成功' }
	}

	@Post('/logout')
	logout() {
		return '登出接口'
	}
}
