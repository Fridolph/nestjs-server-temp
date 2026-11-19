import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'
import { UserService } from '../../user/user.service.ts'

type AuthenticatedRequest = { user?: { userId?: number } }

/** JWT 验证后，按数据库中的当前角色编码放行超管和管理员。 */
@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private readonly us: UserService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
		const userId = request.user?.userId

		if (typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId < 1) {
			throw new UnauthorizedException('请先登录')
		}

		// JWT 只用于确认身份；角色撤销或用户停用后，旧 Token 也不能继续管理资源。
		const user = await this.us.findForAdmin(userId)
		if (
			!user?.isActive ||
			!user?.roles.some(role => ['super_admin', 'admin'].includes(role.roleCode))
		) {
			throw new ForbiddenException('没有管理员权限')
		}
		return true
	}
}
