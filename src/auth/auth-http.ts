import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js'
import type { CookieOptions, Request, Response } from 'express'

export const REFRESH_COOKIE = 'refresh_token'

@Injectable()
export class AuthHttp {
	readonly origins: string[]
	private readonly cookieOptions: CookieOptions
	constructor(config: ConfigService) {
		const production = config.get<string>('NODE_ENV') === 'production'
		const configured = config.get<string>('AUTH_ALLOWED_ORIGINS')
		if (production && !configured) throw new Error('生产环境必须配置 AUTH_ALLOWED_ORIGINS')
		this.origins = (
			configured ??
			'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3050,http://127.0.0.1:3050'
		)
			.split(',')
			.map(value => value.trim())
		if (
			this.origins.some(origin => {
				if (origin === '*') return false
				if (origin.includes('*')) return true
				try {
					const url = new URL(origin)
					return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin
				} catch {
					return true
				}
			})
		) {
			throw new Error('AUTH_ALLOWED_ORIGINS 必须为 * 或 HTTP(S) origin 列表，不能包含路径或局部通配符')
		}
		this.cookieOptions = {
			httpOnly: true,
			secure: production,
			sameSite: 'lax',
			// PREFIX 允许 /api 或 api，Cookie 路径必须规范化，否则浏览器不会携带。
			path: '/' + [config.get<string>('PREFIX') ?? 'api', config.get<string>('VERSION') ?? 'v1', 'auth']
				.map(segment => segment.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/'),
		}
	}

	/** 携带 Cookie 时必须回显具体 Origin；origin: true 会同时设置 Vary: Origin。 */
	get corsOptions(): CorsOptions {
		return { origin: this.origins.includes('*') ? true : this.origins, credentials: true }
	}

	/** CORS 与认证写接口共用来源规则；配置 * 表示信任任意来源。 */
	isOriginAllowed(origin: string) {
		return this.origins.includes('*') || this.origins.includes(origin)
	}

	/** 不依赖 cookie-parser；只读取严格格式的 refresh cookie，不解析其他业务 Cookie。 */
	readRefresh(request: Request) {
		return request.headers.cookie
			?.split(';')
			.map(value => value.trim())
			.find(value => value.startsWith(`${REFRESH_COOKIE}=`))
			?.slice(REFRESH_COOKIE.length + 1)
	}
	writeRefresh(response: Response, token: string, expires: Date) {
		response.cookie(REFRESH_COOKIE, token, { ...this.cookieOptions, expires })
	}
	clearRefresh(response: Response) {
		response.clearCookie(REFRESH_COOKIE, this.cookieOptions)
	}
}

/** 认证写接口要求自定义头；Origin 按配置校验，* 模式下不限制来源。 */
@Injectable()
export class AuthRequestGuard implements CanActivate {
	constructor(private readonly http: AuthHttp) {}
	canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<Request>()
		context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store')
		const origin = request.get('origin')
		if (request.get('x-auth-request') !== '1' || (origin && !this.http.isOriginAllowed(origin))) {
			throw new ForbiddenException('认证请求来源无效')
		}
		return true
	}
}
