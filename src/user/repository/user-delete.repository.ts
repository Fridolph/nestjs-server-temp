import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import User from '../user.entity.ts'
import UserProfile from '../profile/profile.entity.ts'

/** 提供用户及资料的事务删除。 */
@Injectable()
export default class UserDeleteRpst {
	constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

	/**
	 * 在同一事务中先删除资料，再删除用户。
	 *
	 * @remarks
	 * 使用 delete 直接执行删除，不触发加载实体后 remove 对应的实体监听器。
	 * users_roles 和 logs 的处理依赖实际数据库外键规则，本方法未显式清理。
	 * 用户不存在或删除受外键阻止时，资料删除也会回滚。
	 *
	 * @param userId - 已校验的用户主键。
	 * @returns 删除的用户行数。
	 * @throws NotFoundException - 用户删除语句未匹配到记录。
	 */
	removeByUserId(userId: number) {
		return this.userRepository.manager.transaction(async manager => {
			const profiles = manager.getRepository(UserProfile)
			const users = manager.getRepository(User)

			await profiles.delete({ userId })
			const isRemoved = await users.delete(userId)
			if (!isRemoved.affected) throw new NotFoundException('该用户不存在')
			return isRemoved.affected
		})
	}

	/**
	 * 使用原生 SQL 删除资料、使用 TypeORM 删除用户的学习对照版本。
	 *
	 * @remarks
	 * 与 removeByUserId 使用相同事务边界和外键策略；当前不是全原生 SQL 实现。
	 *
	 * @param userId - 已校验的用户主键，通过占位符绑定到资料删除语句。
	 * @returns 删除的用户行数。
	 * @throws NotFoundException - 用户删除语句未匹配到记录。
	 */
	removeByUserIdWithSql(userId: number) {
		return this.userRepository.manager.transaction(async manager => {
			await manager.query(
				`
        DELETE
        FROM profile
        WHERE userId = ?
      `,
				[userId]
			)
			const isRemoved = await manager.getRepository(User).delete(userId)
			if (!isRemoved.affected) throw new NotFoundException('该用户不存在')
			return isRemoved.affected
		})
	}
}
