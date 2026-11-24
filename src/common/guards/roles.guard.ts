import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import type { RoleCode } from '../../roles/roles.dto.ts'
import { UserService } from '../../user/user.service.ts'
import { ROLES_KEY } from '../decorators/roles.decorator.ts'

type AuthenticatedRequest = {
	user?: {
		userId?: number
	}
}

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly userService: UserService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		])

		// 此处的约定：没有声明角色时，不做角色限制。
		// 它不等于“验证用户已登录”，认证仍需要 JwtGuard。
		if (requiredRoles === undefined) {
			return true
		}

		// 防止错误地使用 @Roles() 而传入空数组时意外放行。
		if (requiredRoles.length === 0) {
			throw new ForbiddenException('未配置允许访问的角色')
		}

		const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
		const userId = request.user?.userId

		if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId < 1) {
			throw new UnauthorizedException('请先登录')
		}

		// 读取当前数据库角色，避免 JWT 内旧角色继续生效。
		const user = await this.userService.findForRole(userId)

		if (!user?.isActive) {
			throw new ForbiddenException('用户不存在或已被停用')
		}

		const hasRequiredRole = requiredRoles.some(code => code === user.role.roleCode)

		if (!hasRequiredRole) {
			throw new ForbiddenException('没有该操作权限')
		}

		return true
	}
}
