import 'reflect-metadata'
import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { Reflector } from '@nestjs/core'
import type { ExecutionContext } from '@nestjs/common'
import type { DataSource } from 'typeorm'
import { CaslResource } from '../../decorators/casl-resource.decorator.ts'
import { CaslAction } from '../../constants/casl.ts'
import { CaslResourceRegistry } from '../casl-resource.registry.ts'
import { CaslAbilityService } from '../../../auth/casl.alibity.service.ts'
import type { PermissionsService } from '../../../permissions/permissions.service.ts'
import { parseEffectivePermissions } from '../../../permissions/permissions.service.ts'
import { Can, CheckPolicies } from '../../decorators/casl.decorator.ts'
import { CaslGuard } from '../../guards/casl.guard.ts'
import { assertUpdateFields } from '../field-authorization.ts'
import type { CaslRequest } from '../casl.types.ts'

@CaslResource({ name: 'logs', actions: [CaslAction.Read, CaslAction.Export], fields: ['path'] })
class Logs {}
@CaslResource({
	name: 'profile',
	actions: [CaslAction.Update],
	fields: ['nickname', 'photo', 'address'],
})
class Profile {}

function registryFor(targets: Function[] = [Logs, Profile]) {
	const registry = new CaslResourceRegistry({
		entityMetadatas: targets.map(target => ({
			target,
			isJunction: false,
			columns: ['path', 'nickname', 'photo', 'address'].map(propertyName => ({ propertyName })),
		})),
	} as unknown as DataSource)
	registry.onModuleInit()
	return registry
}

function permission(action = CaslAction.Read, resource = 'logs', fields: string[] | null = null) {
	return { code: `${resource}:${action}`, resource, action, fields }
}

function setup(isSuperAdmin = false, permissions = [permission(), permission(CaslAction.Export)]) {
	const getAccessForUser = vi.fn().mockResolvedValue({ isSuperAdmin, permissions })
	const service = new CaslAbilityService(
		{
			getAccessForUser,
			superPermission: () => permission(CaslAction.Manage, 'all'),
		} as unknown as PermissionsService,
		registryFor()
	)
	return { service, getAccessForUser }
}

function context(request: Partial<CaslRequest>, handler: Function, controller: Function) {
	return {
		switchToHttp: () => ({ getRequest: () => request }),
		getHandler: () => handler,
		getClass: () => controller,
	} as unknown as ExecutionContext
}

describe('CASL 授权边界', () => {
	it('资源映射保持 Entity 类型一致，管理员只获 read/export', async () => {
		const { service } = setup()
		const ability = await service.createForUser({ userId: 2 })
		expect(ability.can('read', Logs)).toBe(true)
		expect(ability.can('export', Logs)).toBe(true)
		expect(ability.can('delete', Logs)).toBe(false)
		expect(ability.can('read', 'logs')).toBe(false)
	})

	it('超管获得跨资源通配；普通角色不能靠 all/manage 记录提权', async () => {
		const { service } = setup(true)
		expect((await service.createForUser({ userId: 1 })).can('delete', Profile)).toBe(true)
		await expect(
			setup(false, [permission(CaslAction.Manage, 'all')]).service.createForUser({ userId: 2 })
		).rejects.toThrow('权限配置无效')
	})

	it('撤销权限在下一请求重新读取，同一请求共享授权 Promise', async () => {
		const { service, getAccessForUser } = setup()
		const request = { user: { userId: 2 } } as CaslRequest
		const first = service.forRequest(request)
		expect(service.forRequest(request)).toBe(first)
		await first
		expect(getAccessForUser).toHaveBeenCalledTimes(1)
		getAccessForUser.mockResolvedValueOnce({ isSuperAdmin: false, permissions: [] })
		expect(
			(await service.forRequest({ user: { userId: 2 } } as CaslRequest)).ability.can('read', Logs)
		).toBe(false)
	})

	it('JSON 文本会解码；缺失、空数组和逗号文本不扩大字段权限', () => {
		expect(parseEffectivePermissions([{ ...permission(), fields: '["path"]' }])[0].fields).toEqual([
			'path',
		])
		for (const fields of [undefined, [], 'null', 'path,method', ['path', 'path']]) {
			expect(() => parseEffectivePermissions([{ ...permission(), fields }])).toThrow('权限配置无效')
		}
	})

	it('未知资源和敏感字段配置拒绝；重复资源启动失败', () => {
		const registry = registryFor()
		expect(() => registry.resolve(permission(CaslAction.Read, 'typo'))).toThrow()
		expect(() => registry.resolve(permission(CaslAction.Read, 'logs', ['password']))).toThrow()
		expect(() => registryFor([Logs, Logs])).toThrow('重复的 CASL 资源')
	})

	it('混合字段请求在写入前整体拒绝，null 和 0 仍执行权限检查', () => {
		const { can, build } = new AbilityBuilder(createMongoAbility)
		can('update', Profile, ['nickname', 'photo'])
		const ability = build({ detectSubjectType: object => object.constructor })
		expect(() =>
			assertUpdateFields(ability, Profile, { nickname: '新昵称', photo: null }, {})
		).not.toThrow()
		expect(() =>
			assertUpdateFields(ability, Profile, { nickname: '新昵称', address: '地址' }, {})
		).toThrow('address')
		expect(() => assertUpdateFields(ability, Profile, { address: 0 }, {})).toThrow('address')
	})
})

describe('CASL Guard 元数据执行', () => {
	class Controller {
		@Can(CaslAction.Read, Logs)
		@Can(CaslAction.Export, Logs)
		twoPolicies(this: void) {}
		@CheckPolicies(() => true)
		identityOnly(this: void) {}
		missing(this: void) {}
	}

	it('重复 Can 不覆盖，任一策略不满足则拒绝', async () => {
		const { service } = setup(false, [permission()])
		const guard = new CaslGuard(new Reflector(), service)
		await expect(
			guard.canActivate(
				context({ user: { userId: 2 } }, Controller.prototype.twoPolicies, Controller)
			)
		).rejects.toThrow('没有执行')
	})

	it('类和方法策略叠加为 AND，方法不能覆盖类要求', async () => {
		@CheckPolicies(ability => ability.can(CaslAction.Export, Logs))
		class Combined {
			@Can(CaslAction.Read, Logs)
			read(this: void) {}
		}
		const guard = new CaslGuard(new Reflector(), setup(false, [permission()]).service)
		await expect(
			guard.canActivate(context({ user: { userId: 2 } }, Combined.prototype.read, Combined))
		).rejects.toThrow('没有执行')
	})

	it('未声明策略默认拒绝；显式身份入口允许无权限用户；无身份返回 401', async () => {
		const guard = new CaslGuard(new Reflector(), setup(false, []).service)
		await expect(
			guard.canActivate(context({ user: { userId: 2 } }, Controller.prototype.missing, Controller))
		).rejects.toThrow('未声明')
		await expect(
			guard.canActivate(
				context({ user: { userId: 2 } }, Controller.prototype.identityOnly, Controller)
			)
		).resolves.toBe(true)
		await expect(
			guard.canActivate(context({}, Controller.prototype.identityOnly, Controller))
		).rejects.toThrow('请先登录')
	})
})
