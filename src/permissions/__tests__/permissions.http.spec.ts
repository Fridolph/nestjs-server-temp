import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { PermissionsController } from '../permissions.controller.ts'
import { PermissionsService } from '../permissions.service.ts'
import { PermissionsRepository } from '../permissions.repository.ts'
import { CaslAbilityService } from '../../auth/casl.alibity.service.ts'
import { JwtStrategy } from '../../auth/auth.strategy.ts'
import { CaslGuard } from '../../common/guards/casl.guard.ts'
import { JwtGuard } from '../../common/guards/jwt.guard.ts'
import { CaslResourceRegistry } from '../../common/casl/casl-resource.registry.ts'
import {
	CASL_RESOURCE_KEY,
	type CaslResourceOptions,
} from '../../common/decorators/casl-resource.decorator.ts'
import Logs from '../../common/logs/logs.entity.ts'
import Profile from '../../user/profile/profile.entity.ts'
import { Permissions } from '../permission.entity.ts'

// 真实 Nest 路由、Passport JWT、Guard 和 Service；只替换持久化，测试不连接数据库。
describe('/permissions 授权 HTTP 链路', () => {
	let app: INestApplication
	const jwt = new JwtService({ secret: 'casl-test-only-secret' })
	const token = (id: number) => jwt.sign({ userId: id, username: 'test' })
	const repository = {
		findAll: vi.fn().mockResolvedValue([]),
		createPermission: vi.fn(async (dto: Record<string, unknown>) => ({ id: 17, ...dto, createdAt: new Date(), updatedAt: new Date() })),
		findById: vi.fn(async (id: number) => id === 17 ? ({ id: 17, code: 'logs:read', name: '日志读取', resource: 'logs', action: 'read', enabled: true, fields: null, createdAt: new Date(), updatedAt: new Date() }) : null),
		updatePermission: vi.fn().mockResolvedValue({ affected: 1 }),
		removeUnassignedPermission: vi.fn().mockResolvedValue('deleted'),
		findUserAccess: vi.fn(async (id: number) =>
			id === 404
				? []
				: [{ userId: id, isActive: id !== 5, roleCode: id === 1 ? 'super_admin' : 'user' }]
		),
		findEffectivePermissions: vi.fn(async (id: number) => {
			if (id === 2) return [{ code: 'log:read', resource: 'logs', action: 'read', fields: null }]
			if (id === 4)
				return [
					{
						code: 'profile:edit-basic',
						resource: 'profile',
						action: 'update',
						fields: ['nickname', 'photo'],
					},
				]
			return []
		}),
	}

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [PassportModule],
			controllers: [PermissionsController],
			providers: [
				PermissionsService,
				CaslAbilityService,
				CaslResourceRegistry,
				CaslGuard,
				JwtGuard,
				JwtStrategy,
				{ provide: PermissionsRepository, useValue: repository },
				{ provide: ConfigService, useValue: { getOrThrow: () => 'casl-test-only-secret' } },
				{
					provide: DataSource,
					useValue: {
						entityMetadatas: [Logs, Profile, Permissions].map(target => ({
							target,
							isJunction: false,
							columns: (
								Reflect.getOwnMetadata(CASL_RESOURCE_KEY, target) as CaslResourceOptions
							).fields.map(propertyName => ({ propertyName })),
						})),
					},
				},
			],
		}).compile()
		app = module.createNestApplication()
		await app.init()
	})
	afterAll(async () => {
		await app?.close()
	})

	it('无 JWT 返回 401，无权限用户可以查询自身空权限但不能冒充目标用户', async () => {
		await request(app.getHttpServer()).get('/permissions/me').expect(401)
		const me = await request(app.getHttpServer())
			.get('/permissions/me')
			.auth(token(3), { type: 'bearer' })
			.expect(200)
		expect(me.body).toEqual({ code: 200, data: [] })
		await request(app.getHttpServer())
			.get('/permissions/1')
			.auth(token(3), { type: 'bearer' })
			.expect(403)
	})

	it('普通用户只获已分配日志动作；超管覆盖没有显式分配的动作', async () => {
		await request(app.getHttpServer())
			.get('/permissions/test/logs/read')
			.auth(token(2), { type: 'bearer' })
			.expect(200)
		await request(app.getHttpServer())
			.get('/permissions/test/logs/export')
			.auth(token(2), { type: 'bearer' })
			.expect(403)
		await request(app.getHttpServer())
			.get('/permissions/test/logs/delete')
			.auth(token(1), { type: 'bearer' })
			.expect(200)
		await request(app.getHttpServer())
			.get('/permissions')
			.auth(token(2), { type: 'bearer' })
			.expect(403)
		await request(app.getHttpServer())
			.get('/permissions/1')
			.auth(token(2), { type: 'bearer' })
			.expect(403)
	})

	it('目录按资源分组并保留动作明细；me 仍返回扁平授权快照', async () => {
		const dates = { createdAt: new Date('2026-11-20T00:00:00Z'), updatedAt: new Date('2026-11-20T00:00:00Z') }
		const rows = [
			{ id: 1, code: 'log:read', name: '系统日志读取', resource: 'logs', action: 'read', fields: null, enabled: true, role: [], ...dates },
			{ id: 2, code: 'log:export', name: '系统日志导出', resource: 'logs', action: 'export', fields: ['path'], enabled: false, ...dates },
			{ id: 3, code: 'profile:basic', name: '基本资料', resource: 'profile', action: 'update', fields: ['nickname'], enabled: true, ...dates },
			{ id: 4, code: 'profile:photo', name: '头像', resource: 'profile', action: 'update', fields: ['photo'], enabled: true, ...dates },
		]
		repository.findAll.mockResolvedValueOnce(rows as never)
		const response = await request(app.getHttpServer()).get('/permissions').auth(token(1), { type: 'bearer' }).expect(200)
		expect(response.body.data).toHaveLength(2)
		expect(response.body.data[0]).toMatchObject({
			resource: 'logs', name: '系统日志', actions: ['read', 'export'],
			permissions: [{ id: 1, fields: null, enabled: true }, { id: 2, fields: ['path'], enabled: false }],
		})
		expect(response.body.data[1]).toMatchObject({ resource: 'profile', actions: ['update'], permissions: [{ id: 3 }, { id: 4 }] })
		expect(response.body.data[0].permissions[0].createdAt).toBe('2026-11-20T00:00:00.000Z')
		const me = await request(app.getHttpServer()).get('/permissions/me').auth(token(2), { type: 'bearer' }).expect(200)
		expect(me.body.data).toEqual([{ code: 'log:read', resource: 'logs', action: 'read', fields: null }])
		const empty = await request(app.getHttpServer()).get('/permissions').auth(token(1), { type: 'bearer' }).expect(200)
		expect(empty.body.data).toEqual([])
	})

	it('字段演示按实际提交字段拒绝，Zod 拒绝额外键', async () => {
		await request(app.getHttpServer())
			.post('/permissions/test/profile/update')
			.auth(token(4), { type: 'bearer' })
			.send({ nickname: '新昵称', photo: null })
			.expect(200)
		await request(app.getHttpServer())
			.post('/permissions/test/profile/update')
			.auth(token(4), { type: 'bearer' })
			.send({ nickname: '新昵称', address: '地址' })
			.expect(403)
		await request(app.getHttpServer())
			.post('/permissions/test/profile/update')
			.auth(token(4), { type: 'bearer' })
			.send({ password: '不允许' })
			.expect(400)
	})

	it('用户停用或删除后，即使 Token 仍有效也拒绝', async () => {
		await request(app.getHttpServer())
			.get('/permissions/test/logs/delete')
			.auth(token(5), { type: 'bearer' })
			.expect(403)
		await request(app.getHttpServer())
			.get('/permissions/me')
			.auth(token(404), { type: 'bearer' })
			.expect(404)
	})

	it('仅超管可写权限目录，并拒绝非法资源、保留动作和编码修改', async () => {
		const input = { code: 'logs:read', name: '日志读取', resource: 'logs', action: 'read', fields: null, enabled: true }
		await request(app.getHttpServer()).post('/permissions').auth(token(2), { type: 'bearer' }).send(input).expect(403)
		const created = await request(app.getHttpServer()).post('/permissions').auth(token(1), { type: 'bearer' }).send(input).expect(201)
		expect(created.body.data.code).toBe('logs:read')
		await request(app.getHttpServer()).post('/permissions').auth(token(1), { type: 'bearer' }).send({ ...input, resource: 'unknown' }).expect(400)
		await request(app.getHttpServer()).post('/permissions').auth(token(1), { type: 'bearer' }).send({ ...input, action: 'manage' }).expect(400)
		await request(app.getHttpServer()).patch('/permissions/17').auth(token(1), { type: 'bearer' }).send({ code: 'logs:delete' }).expect(400)
		await request(app.getHttpServer()).patch('/permissions/17').auth(token(2), { type: 'bearer' }).send({ name: '新名称' }).expect(403)
		await request(app.getHttpServer()).patch('/permissions/17').auth(token(1), { type: 'bearer' }).send({ name: '新名称' }).expect(200)
		await request(app.getHttpServer()).delete('/permissions/17').auth(token(2), { type: 'bearer' }).expect(403)
		await request(app.getHttpServer()).delete('/permissions/17').auth(token(1), { type: 'bearer' }).expect(200)
	})
})
