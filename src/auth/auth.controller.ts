import { registerInputSchema, type RegisterInputDto } from './dto/register.dto.ts'
import { Body, Controller, HttpCode, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common'
import type { Request, Response } from 'express'
import { AuthService } from './auth.service.ts'
import { signinSchema, type SigninDto } from './dto/signin.dto.ts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { AuthHttp, AuthRequestGuard } from './auth-http.ts'

@Controller('auth')
@UseGuards(AuthRequestGuard)
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly http: AuthHttp
	) {}

	/** 注册成功后建立会话，refresh token 只通过 HttpOnly Cookie 返回。 */
	@Post('register')
	@HttpCode(200)
	async register(
		@Body(new ZodValidationPipe(registerInputSchema)) dto: RegisterInputDto,
		@Res({ passthrough: true }) response: Response
	) {
		const session = await this.authService.register(dto)
		this.http.writeRefresh(response, session.refreshToken, session.expiresAt)
		return { code: 200, data: session.data, msg: '注册成功' }
	}

	/** 校验登录参数，返回短期访问令牌并建立独立设备会话。 */
	@Post('signin')
	@HttpCode(200)
	async signin(
		@Body(new ZodValidationPipe(signinSchema)) dto: SigninDto,
		@Res({ passthrough: true }) response: Response
	) {
		const session = await this.authService.signin(dto.username, dto.password)
		this.http.writeRefresh(response, session.refreshToken, session.expiresAt)
		return { code: 200, data: session.data, msg: '登录成功' }
	}

	/** 轮换 refresh token 并签发新 access token；失败时清除浏览器中的无效 Cookie。 */
	@Post('refresh')
	@HttpCode(200)
	async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
		try {
			const session = await this.authService.refresh(this.http.readRefresh(request))
			this.http.writeRefresh(response, session.refreshToken, session.expiresAt)
			return { code: 200, data: session.data, msg: '会话已续期' }
		} catch (error) {
			// 数据库/网络故障不能当成凭证失效，保留 Cookie 便于稍后重试。
			if (error instanceof UnauthorizedException) this.http.clearRefresh(response)
			throw error
		}
	}

	/** 幂等退出：access token 过期也可通过 refresh Cookie 撤销当前会话。 */
	@Post('logout')
	@HttpCode(200)
	async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
		const bearer = request.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
		const result = await this.authService.logout(this.http.readRefresh(request), bearer)
		this.http.clearRefresh(response)
		return result
	}
}
