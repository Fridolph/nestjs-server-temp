import { PermissionsRepository } from '../permissions.repository.ts'
import { PermissionsService } from '../permissions.service.ts'
import type { Repository, QueryRunner } from 'typeorm'
import type { Permissions } from '../permission.entity.ts'
import { PermissionFields1795172400000 } from '../../migrations/1795172400000-permission_fields.ts'
import type { CaslResourceRegistry } from '../../common/casl/casl-resource.registry.ts'

describe('权限持久化契约', () => {
	it('用户 ID 以参数绑定，授权查询包含字段与禁用过滤', async () => {
		const query = vi.fn().mockResolvedValue([])
		const repository = new PermissionsRepository({ query } as unknown as Repository<Permissions>)
		await repository.findEffectivePermissions(18)
		expect(query).toHaveBeenCalledWith(expect.stringContaining('ur.userId = ?'), [18])
		expect(query.mock.calls[0][0]).toContain('CAST(p.fields AS CHAR) AS fields')
		expect(query.mock.calls[0][0]).toContain('p.enabled = 1')
		await repository.findUserAccess(18)
		expect(query.mock.calls[1][0]).toContain('LEFT JOIN')
	})

	it('有效无角色用户返回空权限；不存在与停用明确拒绝；超管不查普通授权', async () => {
		const repository = {
			findUserAccess: vi.fn().mockResolvedValue([{ userId: 2, isActive: 1, roleCode: null }]),
			findEffectivePermissions: vi.fn().mockResolvedValue([]),
		}
		const service = new PermissionsService(repository as unknown as PermissionsRepository, {} as CaslResourceRegistry)
		await expect(service.getAccessForUser(2)).resolves.toEqual({
			isSuperAdmin: false,
			permissions: [],
		})
		repository.findUserAccess.mockResolvedValueOnce([])
		await expect(service.getAccessForUser(404)).rejects.toThrow('用户不存在')
		repository.findUserAccess.mockResolvedValueOnce([{ userId: 2, isActive: 0, roleCode: null }])
		await expect(service.getAccessForUser(2)).rejects.toThrow('停用')
		repository.findUserAccess.mockResolvedValueOnce([
			{ userId: 1, isActive: 1, roleCode: 'super_admin' },
		] as never)
		repository.findEffectivePermissions.mockClear()
		await expect(service.getAccessForUser(1)).resolves.toEqual({
			isSuperAdmin: true,
			permissions: [],
		})
		expect(repository.findEffectivePermissions).not.toHaveBeenCalled()
	})
})

describe('fields 迁移不连接数据库的分支验证', () => {
	const migration = new PermissionFields1795172400000()
	function runner(type?: string, fields: unknown[] = []) {
		const query = vi.fn().mockResolvedValue(fields.map(value => ({ fields: value })))
		const getTable = vi
			.fn()
			.mockResolvedValue({
				findColumnByName: () => (type ? { type, isNullable: true } : undefined),
			})
		return { value: { query, getTable } as unknown as QueryRunner, query }
	}
	it('不存在时新增 JSON，已有 JSON 不重建', async () => {
		const absent = runner()
		await migration.up(absent.value)
		expect(absent.query).toHaveBeenCalledWith('ALTER TABLE `permissions` ADD `fields` json NULL')
		const existing = runner('json', [['nickname']])
		await migration.up(existing.value)
		expect(existing.query.mock.calls.every(([sql]) => !sql.includes('ALTER'))).toBe(true)
	})
	it('文本值非法时在任何 DDL 前拒绝，合法值保留转换', async () => {
		const invalid = runner('varchar', ['nickname,photo'])
		await expect(migration.up(invalid.value)).rejects.toThrow('非 JSON')
		expect(invalid.query.mock.calls.every(([sql]) => !sql.includes('ALTER'))).toBe(true)
		const valid = runner('varchar', ['["nickname","photo"]'])
		await migration.up(valid.value)
		expect(valid.query).toHaveBeenLastCalledWith(
			'ALTER TABLE `permissions` MODIFY `fields` json NULL'
		)
	})
})
