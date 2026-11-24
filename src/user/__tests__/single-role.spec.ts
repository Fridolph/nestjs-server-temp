import 'reflect-metadata'
import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common'
import type { QueryRunner, Repository } from 'typeorm'
import { createUserSchema } from '../dto/create-user.dto.ts'
import UserCreateRpst from '../repository/user-create.repository.ts'
import User from '../user.entity.ts'
import Roles from '../../roles/roles.entity.ts'
import ProfileRpst from '../profile/profile.repository.ts'
import UserProfile from '../profile/profile.entity.ts'
import { RegisterPipe } from '../../auth/auth.pipe.ts'
import { UserSingleRole1795478400001 } from '../../migrations/1795478400001-user_single_role.ts'

const dto = { username: 'learner', password: 'learn!123', roleId: 3 }
function fixture(role: { id: number; roleCode: string } | null = { id: 3, roleCode: 'user' }) {
	const users = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn(value => value), save: vi.fn(async user => { user.id = 42 }) }
	const roles = { findOneBy: vi.fn().mockResolvedValue(role) }
	const profiles = { insert: vi.fn().mockResolvedValue({}) }
	const manager = { getRepository: (entity: unknown) => entity === User ? users : entity === Roles ? roles : profiles }
	const repository = new UserCreateRpst({ manager: { transaction: (callback: (value: typeof manager) => unknown) => callback(manager) } } as unknown as Repository<User>)
	return { repository, users, roles, profiles }
}

describe('单角色创建边界', () => {
	it('注册管道不再生成角色数组，拒绝客户端指定角色', () => {
		const pipe = new RegisterPipe()
		const input = { username: 'learner', password: 'learn!123' }
		expect(pipe.transform(input)).toEqual(input)
		for (const role of [{ roles: [3] }, { roleIds: [3] }, { roleId: 3 }]) {
			expect(() => pipe.transform({ ...input, ...role })).toThrow(BadRequestException)
		}
	})
	it('只接收一个整数角色，拒绝旧数组和缺失角色', () => {
		expect(createUserSchema.safeParse(dto).success).toBe(true)
		for (const roleId of [[3], [2, 3], undefined, null, 0, 1.5]) {
			expect(createUserSchema.safeParse({ ...dto, roleId }).success).toBe(false)
		}
	})
	it('只关联已有单个角色，并用同一事务仓库创建资料', async () => {
		const { repository, users, roles, profiles } = fixture()
		const result = await repository.createUser(dto)
		expect(roles.findOneBy).toHaveBeenCalledWith({ id: 3 })
		expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ roleId: 3, role: { id: 3, roleCode: 'user' } }))
		expect(result.roleId).toBe(3)
		expect(profiles.insert).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }))
	})
	it('超管与不存在角色均不创建用户，注册只按稳定 code 选择普通用户', async () => {
		const forbidden = fixture({ id: 99, roleCode: 'super_admin' })
		await expect(forbidden.repository.createUser({ ...dto, roleId: 99 })).rejects.toBeInstanceOf(ForbiddenException)
		expect(forbidden.users.save).not.toHaveBeenCalled()
		const missing = fixture(null)
		await expect(missing.repository.createUser(dto)).rejects.toBeInstanceOf(BadRequestException)
		await expect(missing.repository.createRegisteredUser(dto)).rejects.toBeInstanceOf(ServiceUnavailableException)
		const registered = fixture()
		await registered.repository.createRegisteredUser(dto)
		expect(registered.roles.findOneBy).toHaveBeenCalledWith({ roleCode: 'user' })
	})
	it('发现多角色歧义时在任何 DDL 前拒绝迁移', async () => {
		const addColumn = vi.fn()
		const runner = { query: vi.fn().mockResolvedValue([{ id: 25 }]), addColumn } as unknown as QueryRunner
		await expect(new UserSingleRole1795478400001().up(runner)).rejects.toThrow('恰好一个角色')
		expect(addColumn).not.toHaveBeenCalled()
	})
})

it('资料的 SQL 与 TypeORM 查询均返回单个 roleId，不加载旧的角色数组关联', async () => {
	const expected = {
		userId: 42, username: 'learner', roleId: 3,
		phone: null, email: null, nickname: 'learner', gender: 0, photo: null, address: null,
	}
	const findOne = vi.fn().mockResolvedValue({
		userId: 42, nickname: 'learner', gender: 0,
		user: { username: 'learner', roleId: 3 },
	})
	const query = vi.fn().mockResolvedValue([expected])
	const repository = new ProfileRpst({ findOne, query } as unknown as Repository<UserProfile>)
	expect(await repository.getProfileById(42)).toEqual(expected)
	expect(await repository.getProfileWithSql(42)).toEqual(expected)
	expect(findOne.mock.calls[0][0]).toMatchObject({
		relations: { user: true }, select: { user: { roleId: true } },
	})
	expect(query.mock.calls[0][0]).not.toContain('users_roles')
})
