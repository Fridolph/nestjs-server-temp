import 'reflect-metadata'
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { Repository } from 'typeorm'
import User from '../user.entity.ts'
import Roles from '../../roles/roles.entity.ts'
import UserProfile from '../profile/profile.entity.ts'
import UserQueryRpst from '../repository/user-query.repository.ts'
import UserCreateRpst from '../repository/user-create.repository.ts'
import UserDeleteRpst from '../repository/user-delete.repository.ts'
import { UserService } from '../user.service.ts'
import { createUserSchema } from '../dto/create-user.dto.ts'

function queryFixture() {
	const query = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ totalCount: '0' }])
	return { query, repository: new UserQueryRpst({ query } as unknown as Repository<User>) }
}

describe('用户查询分页边界', () => {
	it('省略分页时使用第一页和每页 10 条', async () => {
		const { query, repository } = queryFixture()
		await expect(repository.findWithFilters()).resolves.toEqual({ data: [], total: 0 })
		expect(query.mock.calls[0][1]).toEqual([1, 10, 0])
	})

	it('根据指定页码计算偏移量', async () => {
		const { query, repository } = queryFixture()
		await repository.findWithFilters({ page: 3, size: 5 })
		expect(query.mock.calls[0][1]).toEqual([1, 5, 10])
	})

	it('非法分页不能被默认值掩盖', async () => {
		const { query, repository } = queryFixture()
		await expect(repository.findWithFilters({ size: 0 })).rejects.toBeInstanceOf(BadRequestException)
		await expect(repository.findWithFilters({ offset: -1 })).rejects.toBeInstanceOf(BadRequestException)
		expect(query).not.toHaveBeenCalled()
	})

	it('单用户固定取一条，不存在返回 404', async () => {
		const { query, repository } = queryFixture()
		await expect(repository.findById({ id: 18 })).rejects.toBeInstanceOf(NotFoundException)
		expect(query.mock.calls[0][1]).toEqual([1, 18, 1, 0])
	})

	it('缺少 ID 时不执行查询', async () => {
		const { query, repository } = queryFixture()
		await expect(repository.findById({} as { id: number })).rejects.toBeInstanceOf(BadRequestException)
		expect(query).not.toHaveBeenCalled()
	})

	it('批量角色查询不增加列表行数，gender=0 也保留', async () => {
		const query = vi.fn()
			.mockResolvedValueOnce([{ userId: 18, username: 'alice' }])
			.mockResolvedValueOnce([{ totalCount: '1' }])
			.mockResolvedValueOnce([{ userId: 18, roleCode: 'admin' }, { userId: 18, roleCode: 'premium' }])
		const repository = new UserQueryRpst({ query } as unknown as Repository<User>)
		const result = await repository.findWithFilters({ gender: 0 })
		expect(result).toMatchObject({ total: 1, data: [{ userId: 18, roles: ['admin', 'premium'] }] })
		expect(query.mock.calls[0][1]).toEqual([1, 0, 10, 0])
		expect(query.mock.calls[1][1]).toEqual([1, 0])
		expect(query.mock.calls[2][1]).toEqual([18])
	})
})

function createFixture(roles = [{ id: 20, code: 'admin' }]) {
	const users = {
		findOne: vi.fn().mockResolvedValue(null),
		create: vi.fn(value => ({ id: 42, ...value })),
		save: vi.fn().mockResolvedValue(undefined),
	}
	const profiles = { insert: vi.fn().mockResolvedValue(undefined) }
	const manager = {
		getRepository: vi.fn(entity => {
			if (entity === User) return users
			if (entity === UserProfile) return profiles
			if (entity === Roles) return { findBy: vi.fn().mockResolvedValue(roles) }
			throw new Error('Unexpected entity')
		}),
	}
	const transaction = vi.fn(callback => callback(manager))
	const repository = new UserCreateRpst({ manager: { transaction } } as unknown as Repository<User>)
	const dto = createUserSchema.parse({ username: 'alice', password: 'secret123', roleIds: [20] })
	return { repository, users, profiles, dto, transaction }
}

describe('创建用户的角色与事务边界', () => {
	it('允许关联任意有效 ID 的非超管角色，全部写入使用事务 manager', async () => {
		const { repository, users, profiles, dto, transaction } = createFixture()
		await expect(repository.createUser(dto)).resolves.toMatchObject({ id: 42 })
		expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ roles: [{ id: 20, code: 'admin' }] }))
		expect(profiles.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, nickname: 'alice' }))
		expect(transaction).toHaveBeenCalledOnce()
	})

	it('超管 ID 即使不是 1 也拒绝，混合角色不能部分成功', async () => {
		const { repository, users, profiles, dto } = createFixture([{ id: 20, code: 'admin' }, { id: 21, code: 'super_admin' }])
		await expect(repository.createUser({ ...dto, roleIds: [20, 21] })).rejects.toBeInstanceOf(ForbiddenException)
		expect(users.save).not.toHaveBeenCalled()
		expect(profiles.insert).not.toHaveBeenCalled()
	})

	it('角色不存在时不写入用户', async () => {
		const { repository, users, dto } = createFixture([])
		await expect(repository.createUser(dto)).rejects.toBeInstanceOf(BadRequestException)
		expect(users.save).not.toHaveBeenCalled()
	})

	it('资料插入失败向事务管理器传播，不能返回创建成功', async () => {
		const { repository, profiles, dto } = createFixture()
		profiles.insert.mockRejectedValue(new Error('profile constraint'))
		await expect(repository.createUser(dto)).rejects.toThrow('profile constraint')
	})
})

describe('删除结果与 Service 响应', () => {
	it('仓库返回影响行数，Service 负责组装响应', async () => {
		const users = { delete: vi.fn().mockResolvedValue({ affected: 1 }) }
		const profiles = { delete: vi.fn().mockResolvedValue({ affected: 1 }) }
		const manager = { getRepository: (entity: unknown) => entity === User ? users : profiles }
		const repository = new UserDeleteRpst({ manager: { transaction: (callback: (transactionManager: typeof manager) => Promise<number>) => callback(manager) } } as unknown as Repository<User>)
		await expect(repository.removeByUserId(18)).resolves.toBe(1)
		const service = new UserService({} as UserQueryRpst, repository, {} as UserCreateRpst)
		await expect(service.remove(18)).resolves.toEqual({ code: 200, data: true, msg: '用户删除成功' })
	})
})
