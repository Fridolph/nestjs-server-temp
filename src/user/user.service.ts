import type { QueryUserDto } from './user.types.ts'
import type { CreateUserDto } from './dto/create-user.dto.ts'
import type { UpdateUserInputDto } from './dto/update-user.dto.ts'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { parseIntegerQuery } from '../common/utils/number.ts'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import UserDeleteRpst from './repository/user-delete.repository.ts'
import UserQueryRpst from './repository/user-query.repository.ts'
import UserCreateRpst from './repository/user-create.repository.ts'
import UserUpdateRpst from './repository/user-update.repository.ts'
import User from './user.entity.ts'

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User) public userRepository: Repository<User>,
		private readonly queryRpst: UserQueryRpst,
		private readonly deleteRpst: UserDeleteRpst,
		private readonly createRpst: UserCreateRpst,
		private readonly updateRpst: UserUpdateRpst
	) {}

	/**
	 * 分页查询启用用户、资料和角色，默认第 1 页、每页 10 条，最多 100 条。
	 *
	 * @param query - 分页参数及用户、资料、角色筛选条件。
	 * @returns 用户列表与 pageMeta 分页信息。
	 * @throws BadRequestException - 分页或筛选参数无效。
	 */
	async findAll(query: QueryUserDto = {}) {
		const page = parseIntegerQuery(query.page ?? 1, 'page', 1)
		const size = parseIntegerQuery(query.size ?? 10, 'size', 1, 100)
		const offset = (page - 1) * size
		if (!Number.isSafeInteger(offset)) {
			throw new BadRequestException('分页偏移量超出有效范围')
		}
		if (query.username !== undefined && typeof query.username !== 'string') {
			throw new BadRequestException('username 必须是字符串')
		}

		const { data, total } = await this.queryRpst.findWithFilters({
			id: query.id === undefined ? undefined : parseIntegerQuery(query.id, 'id', 1),
			username: query.username?.trim(),
			gender:
				query.gender === undefined ? undefined : parseIntegerQuery(query.gender, 'gender', 0, 1),
			profileId:
				query.profileId === undefined
					? undefined
					: parseIntegerQuery(query.profileId, 'profileId', 1),
			role: query.role === undefined ? undefined : parseIntegerQuery(query.role, 'role', 1),
			size,
			page,
			offset,
		})

		return {
			code: 200,
			data,
			pageMeta: { total, page, size },
		}
	}

	/**
	 * 查询指定 ID 的启用用户及其角色。
	 *
	 * @param userId - 必传的目标用户 ID。
	 * @returns 用户资料与角色 code。
	 * @throws NotFoundException - 没有匹配到启用用户。
	 */
	async findById(userId: number) {
		const data = await this.queryRpst.findById(userId)
		return { code: 200, data }
	}

	/** 内部认证查询，包含密码；交给 AuthService，不组装公开接口响应。 */
	findOneByUsername(username: string) {
		return this.queryRpst.findOneByUsername(username)
	}

	/** 查询一个或多个用户的角色关联明细。 */
	async findRolesByUserIds(ids: number | number[]) {
		const data = await this.queryRpst.findRolesByUserIds(ids)
		return { code: 200, data }
	}

	/**
	 * 创建用户、非超管角色关联及默认资料，任一步失败整体回滚。
	 *
	 * @param createUserDto - 已校验的用户、角色与资料数据。
	 * @returns 创建成功标记与提示，不返回密码等内部字段。
	 */
	async create(createUserDto: CreateUserDto) {
		const newUser = await this.createRpst.createUser(createUserDto)
		return {
			code: 200,
			data: true,
			msg: `用户 [${newUser.id}__${newUser.username}] 创建成功`,
		}
	}

	/** 创建普通用户，事务完成后仅返回身份字段，供 AuthService 自动登录。 */
	async register(dto: Omit<CreateUserDto, 'roleId'>) {
		const newUser = await this.createRpst.createRegisteredUser(dto)
		return {
			code: 200,
			data: {
				userId: newUser.id,
				username: newUser.username,
				roleId: newUser.role.map(role => role.id),
			},
			msg: `[${newUser.id}: ${newUser.username}] 注册成功`,
		}
	}

	/** 原子更新管理后台的用户资料、联系方式与角色。 */
	async updateUser(id: number, actorId: number, dto: UpdateUserInputDto) {
		await this.updateRpst.updateUser(id, actorId, dto)
		return { code: 200, data: true, msg: '用户已更新' }
	}

	/**
	 * 在同一事务中硬删除用户及资料。
	 *
	 * @param userId - 待删除用户的主键。
	 * @returns 删除成功响应。
	 * @throws NotFoundException - 用户不存在。
	 */
	async remove(userId: number) {
		await this.deleteRpst.removeByUserId(userId)
		return { code: 200, data: true, msg: '用户删除成功' }
	}

	async findForRole(userId: number) {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: { role: true },
			select: {
				id: true,
				isActive: true,
				role: {
					id: true,
					roleCode: true,
				},
			},
		})
		if (!user) throw new NotFoundException('未查询到用户信息')
		return user
	}
}
