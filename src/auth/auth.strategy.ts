import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { ConfigEnum } from '../common/config/config.enum.ts'

/** 从 Bearer Token 验证签名与有效期，生成当前请求的用户信息。 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			// 验签密钥必须存在；缺少 SECRET 时中止启动，不用类型断言掩盖配置错误。
			secretOrKey: configService.getOrThrow<string>(ConfigEnum.SECRET),
		})
	}

	/** 签名及过期校验通过后执行，返回值由 Passport 放到 request.user。 */
	validate(payload: { sub: number; username: string }) {
		return {
			userId: payload.sub,
			username: payload.username,
		}
	}
}
