import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

@Injectable()
export class AdminGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest()
		const { roleIds } = req.user

		// 统一转成数组，再判断是否包含管理员角色
		const userRoleIds = Array.isArray(roleIds) ? roleIds : [roleIds]
		const isAdmin = userRoleIds.some(roleId => [1, 2].includes(roleId))

		if (!isAdmin) {
			throw new ForbiddenException('没有管理员权限')
		}

		return true
	}
}
