import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UserService } from '../user/user.service.ts'
import type { RegisterInputDto } from './dto/register.dto.ts'
import { JwtService } from '@nestjs/jwt'
import argon2 from 'argon2'
import { registerOutputSchema } from './dto/register.dto.ts'
import type { UserIdentity } from '../user/user.types.ts'

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService
	) {}

	/** 校验启用用户的凭据并签发 JWT，不返回密码或完整用户记录。 */
	async signin(username: string, password: string) {
		const user = await this.userService.findOneByUsername(username)
		// 统一提示，不区分未知、停用或密码错误；旧明文密码不再支持登录。
		if (!user?.isActive || !user.password?.startsWith('$argon2')) {
			throw new UnauthorizedException('用户名或密码错误')
		}
		if (!(await argon2.verify(user.password, password))) {
			throw new UnauthorizedException('用户名或密码错误')
		}
		return this.issueAuthResponse(
			{ userId: user.id, username: user.username, roleIds: user.roleIds },
			'登录成功'
		)
	}

	logout() {}

	/** 自助注册固定分配普通用户角色，创建事务提交后自动登录。 */
	async register(dto: RegisterInputDto) {
		const { data: identity } = await this.userService.register(dto)
		return this.issueAuthResponse(identity, '注册成功')
	}

	/** 登录和注册共用签发及响应白名单；仅接收已验证或已创建的用户身份。 */
	private async issueAuthResponse(identity: UserIdentity, msg: string) {
		const { userId, username, roleIds } = identity
		const accessToken = await this.jwtService.signAsync({ userId, username, roleIds })
		const data = registerOutputSchema.parse({
			userId,
			username,
			roleIds,
			accessToken,
			tokenType: 'Bearer',
		})
		return { code: 200, data, msg }
	}
}
