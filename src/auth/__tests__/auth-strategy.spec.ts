import 'reflect-metadata'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { describe, expect, it, vi } from 'vitest'
import { JwtStrategy } from '../auth.strategy.ts'

const secret = 'test-only-jwt-secret'

function authenticate(token: string) {
	const strategy = new JwtStrategy(new ConfigService({ SECRET: secret }))
	return new Promise<unknown>((resolve, reject) => {
		strategy.success = user => resolve(user)
		strategy.fail = () => reject(new Error('JWT rejected'))
		strategy.error = reject
		strategy.authenticate({ headers: { authorization: `Bearer ${token}` } } as never)
	})
}

describe('JWT 验签配置与认证', () => {
	it('密钥缺失时立即报错', () => {
		const config = new ConfigService()
		vi.spyOn(config, 'get').mockReturnValue(undefined)
		expect(() => new JwtStrategy(config)).toThrow('SECRET')
	})

	it('有效 token 映射为请求用户信息', async () => {
		const token = new JwtService({ secret }).sign({ sub: 18, username: 'student' })
		await expect(authenticate(token)).resolves.toEqual({ userId: 18, username: 'student' })
	})

	it('签名密钥不同或 token 过期时拒绝认证', async () => {
		const jwt = new JwtService({ secret })
		const wrongSignature = new JwtService({ secret: 'another-test-secret' }).sign({ sub: 18 })
		const expired = jwt.sign({ sub: 18 }, { expiresIn: -1 })
		await expect(authenticate(wrongSignature)).rejects.toThrow('JWT rejected')
		await expect(authenticate(expired)).rejects.toThrow('JWT rejected')
	})
})
