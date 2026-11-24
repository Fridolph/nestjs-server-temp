import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UserService } from '../user/user.service.ts'
import type { RegisterInputDto } from './dto/register.dto.ts'
import { AuthSessionService } from './auth-session.service.ts'
import argon2 from 'argon2'

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private readonly sessions: AuthSessionService
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
		return this.sessions.create({ userId: user.id, username: user.username, roleId: user.roleId })
	}

	/** 撤销当前会话；不影响同一用户的其他设备。 */
	async logout(refreshToken: string | undefined, bearer: string | undefined) {
		await this.sessions.logout(refreshToken, bearer)
		return { code: 200, data: true, msg: '已退出登录' }
	}

	refresh(refreshToken: string | undefined) { return this.sessions.refresh(refreshToken) }

	/** 自助注册固定分配普通用户角色，创建事务提交后自动登录。 */
	async register(dto: RegisterInputDto) {
		const { data: identity } = await this.userService.register(dto)
		return this.sessions.create(identity)
	}
}
