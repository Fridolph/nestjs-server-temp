import type { QueryUserDto } from './user.types.ts'
import type { CreateUserDto } from './dto/create-user.dto.ts'
import { BadRequestException, Injectable } from '@nestjs/common'
import { parseIntegerQuery } from '../common/utils/number.ts'
import UserDeleteRpst from './repository/user-delete.repository.ts'
import UserQueryRpst from './repository/user-query.repository.ts'
import UserCreateRpst from './repository/user-create.repository.ts'

@Injectable()
export class UserService {
	constructor(
		private readonly queryRpst: UserQueryRpst,
		private readonly deleteRpst: UserDeleteRpst,
		private readonly createRpst: UserCreateRpst
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
	 * @param query - 必传的目标用户 ID。
	 * @returns 用户资料与角色 code。
	 * @throws NotFoundException - 没有匹配到启用用户。
	 */
	async findById(query: { id: number }) {
		const data = await this.queryRpst.findById(query)
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

	/** 自助注册，由后端分配普通用户角色并初始化资料。 */
	async register(dto: Omit<CreateUserDto, 'roleIds'>) {
		const newUser = await this.createRpst.createRegisteredUser(dto)
		return { code: 200, data: true, msg: `[${newUser.id}: ${newUser.username}] 注册成功` }
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
}
