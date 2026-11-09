import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { UserListCriteria, UserRoleRow, UserRow } from '../user.types.ts'
import type { Repository } from 'typeorm'
import User from '../user.entity.ts'
import { parseIntegerQuery } from '../../common/utils/number.ts'

/** 负责用户列表及角色关联查询；不组装 HTTP 业务响应。 */
@Injectable()
export default class UserQueryRpst {
	constructor(
		@InjectRepository(User)
		private readonly repository: Repository<User>
	) {}

	/**
	 * 查询启用用户的分页资料、角色 code 和匹配总数。
	 *
	 * @remarks
	 * 缺省分页为第 1 页、每页 10 条；只对未提供的值兜底，非法值仍拒绝。
	 * 列表与 COUNT 共用条件；角色筛选使用 EXISTS，避免多角色造成重复用户。
	 * 角色按当前页用户 ID 一次查询，再在内存中归组，避免逐用户查询。
	 * 三次查询未使用快照事务，并发写入时列表、总数和角色可能存在时间差。
	 *
	 * @param query - 已归一化的用户筛选条件和可选分页参数。
	 * @returns 当前页用户及角色 code 数组，以及转换为 number 的总数。
	 */
	async findWithFilters(query: UserListCriteria = {}) {
		const { id, username, gender, profileId, role } = query
		const page = parseIntegerQuery(query.page ?? 1, 'page', 1)
		const size = parseIntegerQuery(query.size ?? 10, 'size', 1, 100)
		const offset = parseIntegerQuery(query.offset ?? (page - 1) * size, 'offset', 0)

		const filters = [
			{
				value: username ? `%${username}%` : undefined,
				sql: 'u.username LIKE ?',
			},
			{
				value: id,
				sql: 'u.id = ?',
			},
			{
				value: gender,
				sql: 'p.gender = ?',
			},
			{
				value: profileId,
				sql: 'p.userId = ?',
			},
			{
				value: role,
				sql: `EXISTS (
        SELECT 1
        FROM users_roles AS ur
        WHERE ur.userId = u.id
          AND ur.rolesId = ?
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

		// 列表和总数共用同一套 FROM 和 WHERE
		const fromSql = `
    FROM \`user\` AS u
    LEFT JOIN profile AS p ON p.userId = u.id
    WHERE ${conditions.join(' AND ')}
  `

		const dataSql = `
    SELECT
      u.id AS userId,
      u.username,
      p.nickname,
      p.userId AS profileId,
      p.gender,
      p.photo,
      p.address
    ${fromSql}
    ORDER BY userId, u.username
    LIMIT ? OFFSET ?
  `

		const countSql = `
    SELECT COUNT(*) AS totalCount
    ${fromSql}
  `

		const rows = await this.repository.query<UserRow[]>(dataSql, [...parameters, size, offset])

		const [count] = await this.repository.query<{ totalCount: number | string }[]>(countSql, parameters)

		// 查询当前页用户的角色
		const userIds = rows.map(row => row.userId)
		const roleRows = await this.findRolesByUserIds(userIds)

		// 按用户 ID 整理角色
		const rolesByUserId = new Map<number, string[]>()

		for (const role of roleRows) {
			const list = rolesByUserId.get(role.userId) ?? []
			list.push(role.roleCode)
			rolesByUserId.set(role.userId, list)
		}

		const data = rows.map(row => ({
			...row,
			roles: rolesByUserId.get(row.userId) ?? [],
		}))

		return {
			data,
			total: Number(count.totalCount),
		}
	}

	/**
	 * 查询指定 ID 的启用用户及其角色。
	 *
	 * @remarks
	 * ID 必须为正整数，避免缺少 ID 时退化成查询任意用户；固定只取一条。
	 *
	 * @param query - 必传的目标用户 ID。
	 * @returns 用户资料及角色 code 数组。
	 * @throws NotFoundException - 查询执行成功但未匹配到启用用户。
	 */
	async findById(query: { id: number }) {
		const id = parseIntegerQuery(query?.id, 'id', 1)
		const { data } = await this.findWithFilters({
			id,
			size: 1,
			offset: 0,
		})
		if (data.length === 0) throw new NotFoundException('搜索不到该 id 对应的数据')
		return data[0]
	}

	/**
	 * 批量查询用户与角色的关联明细。
	 *
	 * @remarks
	 * 空数组直接返回，避免生成非法的 IN ()。
	 * 动态拼接内容只有占位符，用户 ID 通过参数数组绑定。
	 * 此方法不限制用户启用状态，也不会为没有角色的用户生成记录。
	 *
	 * @param ids - 单个用户主键或用户主键数组。
	 * @returns 按用户 ID、角色 ID 排序的关联行；无匹配时为空数组。
	 */
	async findRolesByUserIds(ids: number | number[]) {
		// 统一转换成数组
		const userIds = typeof ids === 'number' ? [ids] : ids

		if (userIds.length === 0) {
			return [] as UserRoleRow[]
		}

		const placeholders = userIds.map(() => '?').join(', ')

		return await this.repository.query<UserRoleRow[]>(
			`
        SELECT
          ur.userId,
          r.id AS roleId,
          r.code AS roleCode,
          r.name AS roleName
        FROM users_roles AS ur
        INNER JOIN roles AS r ON r.id = ur.rolesId
        WHERE ur.userId IN (${placeholders})
        ORDER BY ur.userId, r.id
      `,
			userIds
		)
	}
}
