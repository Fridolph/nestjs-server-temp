import { DatabaseSync } from 'node:sqlite'
import type { Repository } from 'typeorm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import type { QueryUserDto } from '../user.types.ts'
import type User from '../user.entity.ts'
import type Logs from '../../common/logs/logs.entity.ts'
import { UserService } from '../user.service.ts'

// 查询测试只需要注入标识；实体装饰器和数据库连接不属于本测试范围。
vi.mock('../user.entity.ts', () => ({ default: class User {} }))
vi.mock('../../common/logs/logs.entity.ts', () => ({ default: class Logs {} }))

describe('UserService.findAll 原生 SQL 筛选', () => {
	let database: DatabaseSync
	let service: UserService

	beforeEach(() => {
		database = new DatabaseSync(':memory:')
		database.exec(`
      CREATE TABLE user (id INTEGER PRIMARY KEY, username TEXT, isActive INTEGER);
      CREATE TABLE profile (
        id INTEGER PRIMARY KEY, gender INTEGER, photo TEXT, address TEXT,
        userId INTEGER UNIQUE
      );
      CREATE TABLE users_roles (userId INTEGER, rolesId INTEGER);
      INSERT INTO user VALUES
        (1, 'admin', 1), (2, 'super', 1), (3, 'test', 1),
        (4, 'inactive', 0), (5, 'no-profile', 1);
      INSERT INTO profile VALUES
        (11, 0, 'a.jpg', 'A', 1), (12, 1, 'b.jpg', 'B', 2),
        (13, 0, 'c.jpg', 'C', 3), (14, 0, 'd.jpg', 'D', 4);
      INSERT INTO users_roles VALUES (1, 1), (1, 2), (2, 2), (4, 1);
    `)
		const repository = {
			query: async (sql: string, parameters: (string | number)[]) =>
				database.prepare(sql).all(...parameters),
		} as unknown as Repository<User>
		service = new UserService(repository, {} as Repository<Logs>)
	})

	afterEach(() => database.close())

	it('默认返回有效用户，保留没有 profile 的用户', async () => {
		const result = await service.findAll()
		expect(result.data.map(user => user.id)).toEqual([1, 5, 2, 3])
		expect(result.pageMeta).toEqual({ totalCount: 4, page: 1, size: 10 })
		expect(result.data.find(user => user.id === 5)?.profileId).toBeNull()
	})

	it('组合用户名、gender=0、profileId 和角色条件，并同步统计', async () => {
		const result = await service.findAll({ username: 'admin', gender: '0', profileId: '11', role: '2' })
		expect(result.data.map(user => user.id)).toEqual([1])
		expect(result.pageMeta.totalCount).toBe(1)
	})

	it('条件使用 AND，任一条件不匹配就返回空列表', async () => {
		const result = await service.findAll({ username: 'admin', gender: 1 })
		expect(result.data).toEqual([])
		expect(result.pageMeta.totalCount).toBe(0)
	})

	it('角色过滤不重复返回多角色用户，也不包含停用用户', async () => {
		const result = await service.findAll({ role: '2' })
		expect(result.data.map(user => user.id)).toEqual([1, 2])
		expect(result.pageMeta.totalCount).toBe(2)
	})

	it('字符串分页参数转换为数字，总数不受分页限制', async () => {
		const result = await service.findAll({ gender: '0', page: '2', size: '1' })
		expect(result.data.map(user => user.id)).toEqual([3])
		expect(result.pageMeta).toEqual({ totalCount: 2, page: 2, size: 1 })
	})

	it('用户名中的 SQL 片段只作为参数值', async () => {
		const result = await service.findAll({ username: "' OR 1=1 --" })
		expect(result.data).toEqual([])
		expect(result.pageMeta.totalCount).toBe(0)
	})

	it.each<QueryUserDto>([
		{ page: '0' }, { size: '101' }, { size: '1; DROP TABLE user' },
		{ gender: '' }, { role: '-1' }, { profileId: '1.5' },
		{ page: Number.MAX_SAFE_INTEGER, size: 100 },
	])('拒绝无效参数 %j', async query => {
		await expect(service.findAll(query)).rejects.toBeInstanceOf(BadRequestException)
	})
})
