import 'reflect-metadata'
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common'
import type { Repository } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import User from '../../../user/user.entity.ts'
import { AdminGuard } from '../admin.guard.ts'

function fixture(user: unknown, identity: unknown = { userId: 42, roleIds: [1, 2] }) {
	const findOne = vi.fn().mockResolvedValue(user)
	const guard = new AdminGuard({ findOne } as unknown as Repository<User>)
	const context = {
		switchToHttp: () => ({ getRequest: () => ({ user: identity }) }),
	} as unknown as ExecutionContext
	return { guard, context, findOne }
}

describe('管理员权限使用当前数据库角色', () => {
	it.each(['super_admin', 'admin'])('按编码放行 %s，不依赖角色 ID', async roleCode => {
		const { guard, context } = fixture({ isActive: true, roles: [{ id: 88, roleCode }] })
		await expect(guard.canActivate(context)).resolves.toBe(true)
	})

	it.each(['user', 'premium', 'guest'])(
		'拒绝 %s，Token 中的旧管理员角色 ID 无效',
		async roleCode => {
			const { guard, context } = fixture({ isActive: true, roles: [{ id: 1, roleCode }] })
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException)
		}
	)

	it.each([
		null,
		{ isActive: false, roles: [{ roleCode: 'admin' }] },
		{ isActive: true, roles: [] },
	])('已删除、停用或撤销角色的用户不能管理资源', async user => {
		const { guard, context } = fixture(user)
		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException)
	})

	it('缺少认证身份时返回 401，不访问数据库', async () => {
		const { guard, context, findOne } = fixture(null, null)
		await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
		expect(findOne).not.toHaveBeenCalled()
	})
})
