import type { RegisterDto } from './dto/register.dto.ts'
import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service.ts'
import type { SigninDto } from './dto/signin.dto.ts'
import { RegisterPipe, SigninPipe } from './auth.pipe.ts'

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	/** 校验注册参数后创建用户及其默认资料。 */
	@Post('/register')
	register(@Body(RegisterPipe) dto: RegisterDto) {
		return this.authService.register(dto)
	}

	/** 校验登录参数，返回访问令牌。 */
	@Post('/signin')
	signin(@Body(SigninPipe) dto: SigninDto) {
		const { username, password } = dto
		return this.authService.signin(username, password)
	}

	@Post('/logout')
	logout() {
		return '登出接口'
	}
}
