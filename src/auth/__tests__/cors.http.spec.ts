import 'reflect-metadata'
import { Controller, Post, UseGuards, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AuthHttp, AuthRequestGuard } from '../auth-http.ts'

@Controller('auth')
@UseGuards(AuthRequestGuard)
class CorsAuthController {
	@Post('probe')
	probe() { return { code: 200 } }
}

function configFor(origins: string) {
	return new ConfigService({ NODE_ENV: 'production', AUTH_ALLOWED_ORIGINS: origins })
}

describe.each([
	{ setting: '*', allowed: 'https://any-client.example', wildcard: true },
	{ setting: 'https://admin.example, https://other.example', allowed: 'https://other.example', wildcard: false },
])('CORS 与认证来源配置：$setting', ({ setting, allowed, wildcard }) => {
	let app: INestApplication
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [CorsAuthController],
			providers: [AuthHttp, AuthRequestGuard, { provide: ConfigService, useValue: configFor(setting) }],
		}).compile()
		app = module.createNestApplication()
		app.enableCors(app.get(AuthHttp).corsOptions)
		await app.init()
	})
	afterAll(async () => { await app?.close() })

	it('预检支持自定义认证头，回显 Origin 并允许携带 Cookie', async () => {
		const response = await request(app.getHttpServer()).options('/auth/probe')
			.set('Origin', allowed).set('Access-Control-Request-Method', 'POST')
			.set('Access-Control-Request-Headers', 'content-type,x-auth-request').expect(204)
		expect(response.headers['access-control-allow-origin']).toBe(allowed)
		expect(response.headers['access-control-allow-credentials']).toBe('true')
		expect(response.headers['access-control-allow-headers']).toContain('x-auth-request')
		expect(response.headers.vary).toContain('Origin')
	})

	it('允许的来源可通过认证来源校验，但仍要求自定义头', async () => {
		const response = await request(app.getHttpServer()).post('/auth/probe')
			.set('Origin', allowed).set('X-Auth-Request', '1').expect(201)
		expect(response.headers['access-control-allow-origin']).toBe(allowed)
		expect(response.headers['cache-control']).toBe('no-store')
		await request(app.getHttpServer()).post('/auth/probe').set('Origin', allowed).expect(403)
	})

	it('其他来源在 * 模式下通过，在白名单模式下拒绝', async () => {
		const other = 'https://unlisted.example'
		const response = await request(app.getHttpServer()).post('/auth/probe')
			.set('Origin', other).set('X-Auth-Request', '1').expect(wildcard ? 201 : 403)
		expect(response.headers['access-control-allow-origin']).toBe(wildcard ? other : undefined)
	})
})

it.each(['', 'https://*.example.com', 'https://example.com/path', 'https://example.com/', 'null', '*,invalid'])
	('拒绝非法来源配置：%s', setting => {
		expect(() => new AuthHttp(configFor(setting))).toThrow('AUTH_ALLOWED_ORIGINS')
	})
