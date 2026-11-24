import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'

import { UserService } from '../../user/user.service.ts'

@Injectable()
export class SelfOrSuperGuard implements CanActivate {
	constructor(private readonly users: UserService) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest()
		const currentUser = req.user

		if (!currentUser) throw new UnauthorizedException('请先登录')

		// Guard 执行时，@Param() 上的 Pipe 还没有执行。
		// 因此这里的路由参数仍然是字符串，需要自己校验。
		const rawId = req.params.id
		if (!rawId || !/^[1-9]\d*$/.test(rawId)) {
			throw new BadRequestException('用户 ID 必须是正整数')
		}
		const targetUserId = Number(rawId)

		if (!Number.isSafeInteger(targetUserId)) {
			throw new BadRequestException('用户 ID 超出有效范围')
		}

		const isSelf = currentUser.userId === targetUserId
		const user = await this.users.findForRole(currentUser.userId)
		const isSuperAdmin = user.isActive && user.role.roleCode === 'super_admin'

		if (!isSelf && !isSuperAdmin) {
			throw new ForbiddenException('没有权限修改该用户资料')
		}

		return true
	}
}
