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
})
