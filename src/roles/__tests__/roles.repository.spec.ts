import 'reflect-metadata'
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import type { Repository } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import Roles from '../roles.entity.ts'
import { RolesRpst } from '../roles.repository.ts'

function fixture(role: unknown = { id: 88, roleCode: 'user', users: [] }) {
	const store = {
		findOneBy: vi.fn().mockResolvedValue(role),
		findOne: vi.fn().mockResolvedValue(role),
		create: vi.fn(value => value),
		save: vi.fn().mockResolvedValue({ id: 88 }),
		update: vi.fn().mockResolvedValue({ affected: 1 }),
		existsBy: vi.fn().mockResolvedValue(true),
		remove: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue([{ roleId: 88, roleCode: 'user', roleName: '用户', description: '' }]),
	}
	const manager = { getRepository: vi.fn(() => store) }
	const transaction = vi.fn(callback => callback(manager))
	const repository = new RolesRpst({ ...store, manager: { transaction } } as unknown as Repository<Roles>)
	return { repository, store, manager, transaction }
}

describe('角色持久化的业务保护', () => {
	it('创建超管角色被拒绝，不写入数据库', async () => {
		const { repository, store } = fixture()
		await expect(repository.createRole({ roleName: '超管', roleCode: 'super_admin', description: '' }))
			.rejects.toBeInstanceOf(ForbiddenException)
		expect(store.save).not.toHaveBeenCalled()
	})

	it('唯一键冲突转换为 409', async () => {
		const { repository, store } = fixture()
		store.save.mockRejectedValue({ driverError: { code: 'ER_DUP_ENTRY' } })
		await expect(repository.createRole({ roleName: '用户', roleCode: 'user', description: '' }))
			.rejects.toBeInstanceOf(ConflictException)
	})

	it('按实体属性更新名称，不修改编码或未传字段', async () => {
		const { repository, store } = fixture()
		await repository.updateRoleById(88, { roleName: '新名称' })
		expect(store.update).toHaveBeenCalledWith(88, { roleName: '新名称' })
	})

	it('重复提交原值允许成功，更新期间目标被删除则返回 404', async () => {
		const { repository, store } = fixture()
		store.update.mockResolvedValue({ affected: 0 })
		await expect(repository.updateRoleById(88, { description: '' })).resolves.toBeUndefined()
		store.existsBy.mockResolvedValue(false)
		await expect(repository.updateRoleById(88, { description: '' })).rejects.toBeInstanceOf(NotFoundException)
	})

	it('超管角色既不能编辑也不能删除', async () => {
		const { repository, store } = fixture({ id: 88, roleCode: 'super_admin', users: [] })
		await expect(repository.updateRoleById(88, { roleName: '新名字' })).rejects.toBeInstanceOf(ForbiddenException)
		await expect(repository.deleteRoleById(88)).rejects.toBeInstanceOf(ForbiddenException)
		expect(store.update).not.toHaveBeenCalled()
		expect(store.remove).not.toHaveBeenCalled()
	})

	it('仍被用户关联的角色不能删除', async () => {
		const { repository, store } = fixture({ id: 88, roleCode: 'user', users: [{ id: 42 }] })
		await expect(repository.deleteRoleById(88)).rejects.toBeInstanceOf(ConflictException)
		expect(store.remove).not.toHaveBeenCalled()
	})

	it('删除检查与写入共用同一事务仓库', async () => {
		const { repository, store, transaction, manager } = fixture()
		await repository.deleteRoleById(88)
		expect(transaction).toHaveBeenCalledOnce()
		expect(manager.getRepository).toHaveBeenCalledWith(Roles)
		expect(store.remove).toHaveBeenCalledWith({ id: 88, roleCode: 'user', users: [] })
	})

	it('查询、修改、删除不存在的角色均返回 404', async () => {
		const { repository, store } = fixture(null)
		store.query.mockResolvedValue([])
		await expect(repository.findRoleById(88)).rejects.toBeInstanceOf(NotFoundException)
		await expect(repository.updateRoleById(88, { roleName: '用户' })).rejects.toBeInstanceOf(NotFoundException)
		await expect(repository.deleteRoleById(88)).rejects.toBeInstanceOf(NotFoundException)
	})
})
