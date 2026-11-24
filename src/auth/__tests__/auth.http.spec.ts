import 'reflect-metadata'
import { Controller, Get, UseGuards, type INestApplication, Req } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import request from 'supertest'
import argon2 from 'argon2'
import { AuthController } from '../auth.controller.ts'
import { AuthService } from '../auth.service.ts'
import { AuthSessionService, hashRefreshToken } from '../auth-session.service.ts'
import { AuthSessionRepository } from '../auth-session.repository.ts'
import { AuthHttp, AuthRequestGuard } from '../auth-http.ts'
import { JwtStrategy } from '../auth.strategy.ts'
import { JwtGuard } from '../../common/guards/jwt.guard.ts'
import { UserService } from '../../user/user.service.ts'
import type { UserIdentity } from '../../user/user.types.ts'

@Controller('protected')
class ProtectedController {
	@Get()
	@UseGuards(JwtGuard)
	read(@Req() request: { user: UserIdentity }) { return { code: 200, data: request.user } }
}

describe('认证 HTTP：真实 Passport、签名、续期及退出，持久化用内存替身', () => {
	let app: INestApplication
	let password: string
	let active = true
	const sessions = new Map<string, { userId: number; hash: string; expiresAt: Date; revoked: boolean }>()
	const identity: UserIdentity = { userId: 9, username: 'learner', roleId: 3 }
	const jwt = new JwtService({ secret: 'test-session-secret' })
	const repository = {
		createSession: vi.fn(async (id: string, userId: number, hash: string, expiresAt: Date) => { sessions.set(id, { userId, hash, expiresAt, revoked: false }) }),
		findActive: vi.fn(async (id: string, userId: number) => {
			const row = sessions.get(id)
			return row && row.userId === userId && !row.revoked && row.expiresAt > new Date() && active ? identity : null
		}),
		rotate: vi.fn(async (id: string, hash: string, nextHash: string) => {
			const row = sessions.get(id)
			if (!row || row.revoked || row.expiresAt <= new Date()) return null
			if (row.hash !== hash || !active) { row.revoked = true; return null }
			row.hash = nextHash
			return { identity, expiresAt: row.expiresAt }
		}),
		revoke: vi.fn(async (id: string, credential: { userId?: number; refreshHash?: string }) => {
			const row = sessions.get(id)
			if (row && (row.userId === credential.userId || row.hash === credential.refreshHash)) row.revoked = true
		}),
	}
	beforeAll(async () => {
		password = await argon2.hash('learning!123')
		const module = await Test.createTestingModule({
			imports: [PassportModule], controllers: [AuthController, ProtectedController],
			providers: [AuthService, AuthSessionService, AuthHttp, AuthRequestGuard, JwtStrategy, JwtGuard,
				{ provide: ConfigService, useValue: { get: (key: string) => ({ NODE_ENV: 'development' })[key as 'NODE_ENV'], getOrThrow: () => 'test-session-secret' } },
				{ provide: JwtService, useValue: jwt }, { provide: AuthSessionRepository, useValue: repository },
				{ provide: UserService, useValue: {
					findOneByUsername: async () => ({ id: 9, username: 'learner', password, roleId: 3, isActive: active }),
					register: async () => ({ data: identity }),
				} },
			],
		}).compile()
		app = module.createNestApplication()
		await app.init()
	})
	afterAll(async () => { await app?.close() })
	beforeEach(() => { sessions.clear(); active = true })
	const post = (path: string) => request(app.getHttpServer()).post(`/auth/${path}`).set('X-Auth-Request', '1').set('Origin', 'http://localhost:3050')
	async function signin() {
		const response = await post('signin').send({ username: 'learner', password: 'learning!123' }).expect(200)
		const cookie = response.headers['set-cookie'][0] as string
		return { response, cookie: cookie.split(';')[0], token: response.body.data.accessToken as string }
	}
	const protectedRequest = (token: string) => request(app.getHttpServer()).get('/protected').auth(token, { type: 'bearer' })

	it('登录只暴露 access token，refresh Cookie 有安全属性、窄路径，数据库只存摘要', async () => {
		const { response, cookie, token } = await signin()
		expect(response.body.data).not.toHaveProperty('refreshToken')
		expect(response.body.data).not.toHaveProperty('password')
		expect(response.body.data.roleId).toBe(3)
		expect(response.headers['cache-control']).toBe('no-store')
		expect(response.headers['set-cookie'][0]).toContain('HttpOnly')
		expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax')
		expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth')
		const payload = jwt.verify(token)
		expect(payload.exp - payload.iat).toBe(900)
		expect(sessions.get(payload.sid)?.hash).toBe(hashRefreshToken(cookie.split('=')[1]))
		await protectedRequest(token).expect(200)
	})

	it('退出后旧 JWT 及 refresh 都立即拒绝，其他设备不受影响，重复退出成功', async () => {
		const first = await signin()
		const other = await signin()
		await post('logout').set('Cookie', first.cookie).auth(first.token, { type: 'bearer' }).expect(200)
		await protectedRequest(first.token).expect(401)
		await post('refresh').set('Cookie', first.cookie).expect(401)
		await protectedRequest(other.token).expect(200)
		const repeat = await post('logout').set('Cookie', first.cookie).expect(200)
		expect(repeat.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970')
	})

	it('续期轮换 Cookie；旧 refresh 重放会撤销整个会话', async () => {
		const { cookie } = await signin()
		const refreshed = await post('refresh').set('Cookie', cookie).expect(200)
		expect(refreshed.headers['set-cookie'][0].split(';')[0]).not.toBe(cookie)
		await protectedRequest(refreshed.body.data.accessToken).expect(200)
		await post('refresh').set('Cookie', cookie).expect(401)
		await protectedRequest(refreshed.body.data.accessToken).expect(401)
	})

	it('登录、注册和续期响应及 JWT 都使用单个 roleId', async () => {
		const { response, cookie } = await signin()
		const registered = await post('register').send({ username: 'learner', password: 'learning!123' }).expect(200)
		const refreshed = await post('refresh').set('Cookie', cookie).expect(200)
		for (const result of [response, registered, refreshed]) {
			expect(result.body.data.roleId).toBe(3)
			expect(result.body.data).not.toHaveProperty('roleIds')
			expect(result.body.data).not.toHaveProperty('roles')
			expect(jwt.verify(result.body.data.accessToken).roleId).toBe(3)
		}
	})

	it('过期 JWT 可退出；伪造签名、无 sid 的旧版 JWT 和停用用户均不可访问', async () => {
		const { token } = await signin()
		const { userId, sid } = jwt.verify(token)
		const expired = jwt.sign({ userId, sid, tokenType: 'access' }, { expiresIn: -1 })
		await protectedRequest(expired).expect(401)
		await post('logout').auth(expired, { type: 'bearer' }).expect(200)
		await protectedRequest(token).expect(401)
		await protectedRequest(jwt.sign({ userId: 9 })).expect(401)
		const second = await signin()
		await protectedRequest(second.token.slice(0, -3) + 'abc').expect(401)
		active = false
		await protectedRequest(second.token).expect(401)
		await post('refresh').set('Cookie', second.cookie).expect(401)
	})

	it('CSRF 来源和自定义头必须符合约定；错误凭据仍返回401，不影响现有会话', async () => {
		await request(app.getHttpServer()).post('/auth/logout').expect(403)
		await post('logout').set('Origin', 'https://evil.example').expect(403)
		await post('signin').send({ username: 'learner', password: 'wrong!123' }).expect(401)
		await post('register').send({ username: 'learner', password: 'learning!123' }).expect(200)
	})
})

it('生产环境 Cookie 必须 Secure，且拒绝没有明确 Origin 配置的启动', () => {
	const config = { get: (key: string) => ({ NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS: 'https://admin.example.com' })[key as 'NODE_ENV'] }
	const http = new AuthHttp(config as unknown as ConfigService)
	const cookie = vi.fn()
	http.writeRefresh({ cookie } as never, 'opaque', new Date())
	expect(cookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' })
	expect(() => new AuthHttp({ get: () => 'production' } as unknown as ConfigService)).toThrow()
})


it('前缀带斜杠时 Cookie 路径仍规范化为 /api/v1/auth', () => {
	const http = new AuthHttp({ get: (key: string) => ({ PREFIX: '/api/', VERSION: '/v1/' })[key as 'PREFIX'] } as unknown as ConfigService)
	const cookie = vi.fn()
	http.writeRefresh({ cookie } as never, 'opaque', new Date())
	expect(cookie.mock.calls[0][2].path).toBe('/api/v1/auth')
})
