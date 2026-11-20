import {
	BadRequestException,
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'

// 超级管理员的实际角色 ID
const SUPER_ADMIN_ROLE_ID = 1

@Injectable()
export class SelfOrSuperGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
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
		const roleId = Array.isArray(currentUser.roleId) ? currentUser.roleId : [currentUser.roleId]
		const isSuperAdmin = roleId.includes(SUPER_ADMIN_ROLE_ID)

		if (!isSelf && !isSuperAdmin) {
			throw new ForbiddenException('没有权限修改该用户资料')
		}

		return true
	}
}
