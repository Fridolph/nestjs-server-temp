import type { Repository } from 'typeorm'
import type {
	CreateUserDto,
	QueryUserDto,
	UpdateUserDto,
	UserWithProfileRow,
} from './user.types.ts'
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import User from './user.entity.ts'
import Logs from '../common/logs/logs.entity.ts'
import UserProfile from './profile/profile.entity.ts'
import { ProfileService } from './profile/profile.service.ts'

@Injectable()
export class UserService {
	/**
	 * 初始化用户服务及其数据访问依赖。
	 *
	 * @param userRepository - 用户实体仓库。
	 * @param logsRepository - 用户日志实体仓库。
	 */
	constructor(
		private readonly profileService: ProfileService,
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Logs) private readonly logsRepository: Repository<Logs>
	) {}

	/**
	 * 按筛选条件分页查询启用用户，并返回关联资料和匹配总数。
	 *
	 * @remarks
	 * 用户名使用包含匹配，所有筛选条件以 AND 连接；角色通过 EXISTS 筛选。
	 * 未关联资料的用户仍会返回，但指定资料筛选条件后只返回匹配的用户。
	 * 列表与总数共用筛选条件，分页默认第 1 页、每页 10 条，每页最多 100 条。
	 * 返回的 profileId 对应 profile.userId，无资料时为 null。
	 *
	 * @param query - 分页参数及用户名、性别、资料所属用户 ID、角色 ID 筛选条件。
	 * @returns 包含业务状态码、分页信息和当前页用户资料的响应。
	 * @throws BadRequestException - 分页参数无效、偏移量超出安全整数范围，或用户名不是字符串。
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
		const username = query.username?.trim()

		const filters = [
			{
				value: username ? `%${username}%` : undefined,
				sql: 'u.username LIKE ?',
			},
			{
				value: query.gender,
				sql: 'p.gender = ?',
			},
			{
				value: query.profileId,
				sql: 'p.userId = ?',
			},
			{
				value: query.role,
				sql: `EXISTS (
          SELECT 1
          FROM users_roles
          WHERE users_roles.userId = u.id
            AND users_roles.rolesId = ?
        )`,
			},
		]

		const conditions = ['u.isActive = ?']
		const parameters: (string | number)[] = [1]

		for (const filter of filters) {
			if (filter.value === undefined) continue

			conditions.push(filter.sql)
			parameters.push(filter.value)
		}

		const fromSql = `
      FROM \`user\` AS u
      LEFT JOIN profile AS p ON p.userId = u.id
      WHERE ${conditions.join(' AND ')}
    `
		const dataSql = `
      SELECT
        u.id,
        u.username,
        p.nickname,
        p.userId AS profileId,
        p.gender,
        p.photo,
        p.address
      ${fromSql}
      ORDER BY u.id, u.username
      LIMIT ? OFFSET ?
    `

		const countSql = `
      SELECT COUNT(*) AS totalCount
      ${fromSql}
    `

		const data = await this.userRepository.query<UserWithProfileRow[]>(dataSql, [
			...parameters,
			size,
			offset,
		])
		const [count] = await this.userRepository.query<{ totalCount: string | number }[]>(
			countSql,
			parameters
		)

		return {
			code: 200,
			pagination: {
				total: Number(count.totalCount),
				page,
				size,
			},
			data,
		}
	}

	/**
	 * 按用户主键查询用户，不限制启用状态，也不主动加载关联资料。
	 *
	 * @param id - 用户主键。
	 * @returns 用户实体；不存在时返回 null。
	 */
	findOne(id: number) {
		return this.userRepository.findOne({
			where: { id },
		})
	}

	/**
	 * 按用户名查询用户，不限制启用状态。
	 *
	 * @param username - 待匹配的用户名，匹配行为遵循数据库排序规则。
	 * @returns 匹配的用户实体；不存在时返回 null。
	 */
	findByUsername(username: string) {
		return this.userRepository.findOne({
			where: {
				username,
			},
		})
	}

	/**
	 * 在同一事务中创建用户和默认资料。
	 *
	 * @remarks
	 * 先检查用户名，再保存用户，并以用户名初始化资料昵称。
	 * 当前仅写入请求中的用户名和密码；任一步骤抛错时回滚事务。
	 * 提前查重不保证并发唯一性，仍需数据库唯一约束兜底。
	 *
	 * @param createUserDto - 创建用户的请求数据。
	 * @returns 事务提交后的成功响应，包含业务状态码、成功标记和用户信息提示。
	 */
	async create(createUserDto: CreateUserDto) {
		const dto = {
			username: createUserDto.username,
			password: createUserDto.password,
		}

		const newUser = await this.userRepository.manager.transaction(async manager => {
			const users = manager.getRepository(User)
			const profiles = manager.getRepository(UserProfile)
			const isExist = await users.findOne({
				where: { username: dto.username },
			})
			if (isExist) throw new ConflictException('用户名已被使用')

			const user = users.create({
				username: dto.username,
				password: dto.password,
			})
			await users.save(user)
			await profiles.insert({
				userId: user.id,
				nickname: user.username,
			})
			return user
		})

		return {
			code: 200,
			data: true,
			msg: `用户 [${newUser.id}__${newUser.username}] 创建成功`,
		}
	}

	async findProfile() {}

	async update(id: number, updateUserDto: UpdateUserDto) {
		// 好的，现在思路有了，1、先检查传入 id 和 updateUserDto 是否符合规范
		// updateUserDto 可以使用 Pipe 吗？  这里我不会可以帮我完善下
		// const newUser = this.userRepository.merge(userTemp as any, user)
		// 联合模型更新，需要使用 save 方法或者 queryBuilder
		// return this.userRepository.save(newUser)
		// 这种 update 只适合单模型的更新，不适合有关系的模型更新
		// return this.userRepository.update(id, { username })
	}

	/**
	 * 在同一事务中先硬删除用户资料，再硬删除用户。
	 *
	 * @remarks
	 * 当前仅显式清理 profile；其他关联外键仍可能阻止用户删除。
	 * 用户删除失败时，之前删除的资料也会回滚。
	 * 使用仓库 delete 方法，不通过加载实体后调用 remove 的流程删除。
	 *
	 * @param id - 待删除用户的主键。
	 * @returns 事务提交后的删除成功响应。
	 * @throws NotFoundException - 没有删除到对应用户。
	 * @throws 数据库外键约束等错误会向调用方传播，并回滚事务。
	 */
	async remove(id: number) {
		return this.userRepository.manager.transaction(async manager => {
			await manager.query('DELETE FROM profile WHERE userId = ?', [id])

			const result = await manager.getRepository(User).delete(id)

			if (!result.affected) {
				throw new NotFoundException('该用户不存在')
			}

			return {
				code: 200,
				data: true,
				message: '用户删除成功',
			}
		})
	}
}

/**
 * 将数字或十进制整数字符串解析为指定范围内的安全整数。
 *
 * @param value - 待解析的查询参数。
 * @param field - 参数名称，用于构造校验失败提示。
 * @param min - 允许的最小值，包含边界。
 * @param max - 允许的最大值，包含边界，默认使用最大安全整数。
 * @returns 校验通过的整数。
 * @throws BadRequestException - 参数类型、整数格式或数值范围不符合要求。
 */
function parseIntegerQuery(
	value: unknown,
	field: string,
	min: number,
	max = Number.MAX_SAFE_INTEGER
) {
	if (
		(typeof value !== 'number' && typeof value !== 'string') ||
		(typeof value === 'string' && !/^\d+$/.test(value.trim()))
	) {
		throw new BadRequestException(`${field} 必须是 ${min} 到 ${max} 之间的整数`)
	}
	const number = Number(value)
	if (!Number.isSafeInteger(number) || number < min || number > max) {
		throw new BadRequestException(`${field} 必须是 ${min} 到 ${max} 之间的整数`)
	}
	return number
}
