import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UserService } from '../user/user.service.ts'
import type { RegisterDto } from './dto/register.dto.ts'
import { JwtService } from '@nestjs/jwt'

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService
	) {}

	/** 校验启用用户的凭据并签发 JWT，不返回密码或完整用户记录。 */
	async signin(username: string, password: string) {
		const user = await this.userService.findOneByUsername(username)
		// 统一提示，避免泄露账号是否存在；未设置密码的旧账号也不能登录。
		// 当前练习库仍存原值密码；改为哈希存储后，应替换为对应的 verify/compare。
		if (!user || !user.isActive || !user.password || user.password !== password) {
			throw new UnauthorizedException('用户名或密码错误')
		}
		// JWT payload 可被解码读取，只放用户标识，不放密码。
		const accessToken = await this.jwtService.signAsync({
			username: user.username,
			sub: user.id,
		})
		return {
			code: 200,
			data: { userId: user.id, username: user.username, accessToken, tokenType: 'Bearer' },
			msg: '登录成功',
		}
	}

	logout() {}

	/** 自助注册固定分配普通用户角色。 */
	register(dto: RegisterDto) {
		return this.userService.register(dto)
	}
}
