import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import User from '../../user/user.entity.ts'

type AuthenticatedRequest = { user?: { userId?: number } }
/** 从数据库按稳定 role.code 判断超管身份，避免用可变角色 ID 授权。 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
	constructor(@InjectRepository(User) private readonly users: Repository<User>) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
		const userId = request.user?.userId
		if (!userId) throw new ForbiddenException('无法识别当前用户')
		const user = await this.users.findOne({ where: { id: userId }, relations: { role: true } })
		if (!user?.role.some(role => role.roleCode === 'super_admin'))
			throw new ForbiddenException('只有超管可以管理角色')
		return true
	}
}
