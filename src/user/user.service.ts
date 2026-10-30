import type { Repository } from 'typeorm'
import type { CreateUserDto, QueryUserDto, UserWithProfileRow } from './user.types.ts'
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import User from './user.entity.ts'
import Logs from '../common/logs/logs.entity.ts'
import UserProfile from './profile/profile.entity.ts'
import { buffer } from 'node:stream/consumers'

@Injectable()
export class UserService {
	constructor(
		@InjectRepository(User) private readonly userRepository: Repository<User>,
		@InjectRepository(Logs) private readonly logsRepository: Repository<Logs>
	) {}

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
        p.userId AS profileId,
        p.gender,
        p.photo,
        p.address
      ${fromSql}
      ORDER BY u.username, u.id
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

	findOne(id: number) {
		return this.userRepository.findOne({
			where: { id },
		})
	}

	findByUsername(username: string) {
		return this.userRepository.findOne({
			where: {
				username,
			},
		})
	}

	async create(createUserDto: CreateUserDto) {
		const dto = {
			username: createUserDto.username,
			password: createUserDto.password,
		}
		const isExist = await this.userRepository.findOne({
			where: {
				username: dto.username,
			},
		})
		if (isExist) {
			throw new ConflictException(`${dto.username} 用户名已被使用`)
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

	async update(id: number, user: Partial<Pick<User, 'username'>>) {
		const { username } = user

		if (username === undefined) {
			throw new BadRequestException('没有提供可更新的字段')
		}

		return this.userRepository.update(id, { username })
	}

	remove(id: number) {
		return this.userRepository.delete(id)
	}
}

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
