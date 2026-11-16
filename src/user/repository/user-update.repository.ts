import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import User from '../user.entity.ts'
import UserProfile from '../profile/profile.entity.ts'
import Roles from '../roles/roles.entity.ts'
import type { UpdateUserInputDto } from '../dto/update-user.dto.ts'

/** 将用户联系方式、角色和资料修改放在同一事务中。 */
@Injectable()
export default class UserUpdateRpst {
	constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

	async updateUser(id: number, actorId: number, dto: UpdateUserInputDto) {
		return this.users.manager.transaction(async manager => {
			const users = manager.getRepository(User)
			const target = await users.findOne({ where: { id }, relations: { roles: true } })
			if (!target) throw new NotFoundException('用户不存在')

			if (dto.roleCode !== undefined) {
				const actor = await users.findOne({ where: { id: actorId }, relations: { roles: true } })
				if (!actor?.roles.some(role => role.code === 'super_admin')) {
					throw new ForbiddenException('只有超管可以修改用户角色')
				}
				if (target.roles.some(role => role.code === 'super_admin')) {
					throw new ForbiddenException('超管角色不可修改')
				}
				const role = await manager.getRepository(Roles).findOneBy({ code: dto.roleCode })
				if (!role) throw new NotFoundException('所选角色不存在')
				target.roles = [role]
			}

			if (dto.phone !== undefined) target.phone = dto.phone
			if (dto.email !== undefined) target.email = dto.email
			if (dto.phone !== undefined || dto.email !== undefined || dto.roleCode !== undefined) {
				await users.save(target)
			}
			if (dto.profile) {
				const result = await manager.getRepository(UserProfile).update({ userId: id }, dto.profile)
				if (
					!result.affected &&
					!(await manager.getRepository(UserProfile).existsBy({ userId: id }))
				) {
					throw new NotFoundException('用户资料不存在')
				}
			}
		})
	}
}
