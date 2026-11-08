import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { Repository } from 'typeorm'
import User from '../user.entity.ts'
import Roles from '../../roles/roles.entity.ts'
import UserProfile from '../profile/profile.entity.ts'
import Logs from '../../common/logs/logs.entity.ts'
import { createUserSchema } from '../dto/create-user.dto.ts'
import { UserService } from '../user.service.ts'

const payload = {
	username: ' alice ',
	password: 'secret123',
	roleIds: [2, 3],
	nickname: ' 小明 ',
	gender: 1,
	photo: 'https://example.com/photo.png',
	address: '北京',
}

describe('创建用户', () => {
	it('校验角色和可选资料，并归一化用户名与昵称', () => {
		expect(createUserSchema.parse(payload)).toEqual({ ...payload, username: 'alice', nickname: '小明' })
		expect(createUserSchema.safeParse({ ...payload, roleIds: [1] }).success).toBe(false)
		expect(createUserSchema.safeParse({ ...payload, roleIds: [2, 2] }).success).toBe(false)
		expect(createUserSchema.safeParse({ ...payload, roleIds: [] }).success).toBe(false)
		expect(createUserSchema.safeParse({ ...payload, password: 'abc12' }).success).toBe(false)
		expect(createUserSchema.safeParse({ ...payload, password: '123456' }).success).toBe(false)
		expect(createUserSchema.safeParse({ ...payload, password: 'abcdef' }).success).toBe(false)
	})

	it('在同一事务中保存角色关联和用户资料', async () => {
		const roles = [{ id: 2 }, { id: 3 }]
		const roleRepository = { findBy: vi.fn().mockResolvedValue(roles) }
		const users = {
			findOne: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockImplementation(value => ({ id: 42, ...value })),
			save: vi.fn().mockResolvedValue(undefined),
		}
		const profiles = { insert: vi.fn().mockResolvedValue(undefined) }
		const manager = {
			getRepository: vi.fn(entity => {
				if (entity === User) return users
				if (entity === Roles) return roleRepository
				if (entity === UserProfile) return profiles
				throw new Error('Unexpected entity')
			}),
		}
		const transaction = vi.fn(callback => callback(manager))
		const service = new UserService(
			{ manager: { transaction } } as unknown as Repository<User>,
			{} as Repository<Logs>,
			{} as Repository<Roles>
		)

		await expect(service.create(createUserSchema.parse(payload))).resolves.toMatchObject({ code: 200, data: true })
		expect(users.create).toHaveBeenCalledWith({ username: 'alice', password: payload.password, roles })
		expect(profiles.insert).toHaveBeenCalledWith({
			userId: 42,
			nickname: '小明',
			gender: 1,
			photo: payload.photo,
			address: payload.address,
		})
		expect(transaction).toHaveBeenCalledOnce()
	})

	it('所选角色不存在时拒绝创建用户', async () => {
		const users = { findOne: vi.fn(), save: vi.fn() }
		const manager = {
			getRepository: vi.fn(entity => entity === Roles ? { findBy: vi.fn().mockResolvedValue([{ id: 2 }]) } : users),
		}
		const service = new UserService(
			{ manager: { transaction: callback => callback(manager) } } as unknown as Repository<User>,
			{} as Repository<Logs>,
			{} as Repository<Roles>
		)

		await expect(service.create(createUserSchema.parse(payload))).rejects.toBeInstanceOf(BadRequestException)
		expect(users.findOne).not.toHaveBeenCalled()
		expect(users.save).not.toHaveBeenCalled()
	})
})
