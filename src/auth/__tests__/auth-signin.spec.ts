import 'reflect-metadata'
import { UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { Repository } from 'typeorm'
import { describe, expect, it, vi } from 'vitest'
import { AuthService } from '../auth.service.ts'
import { UserService } from '../../user/user.service.ts'
import UserQueryRpst from '../../user/repository/user-query.repository.ts'
import type UserCreateRpst from '../../user/repository/user-create.repository.ts'
import type UserDeleteRpst from '../../user/repository/user-delete.repository.ts'
import type User from '../../user/user.entity.ts'

function fixture(rows: unknown[]) {
	const query = vi.fn().mockResolvedValue(rows)
	const repository = new UserQueryRpst({ query } as unknown as Repository<User>)
	const users = new UserService(repository, {} as UserDeleteRpst, {} as UserCreateRpst)
	const jwt = new JwtService({ secret: 'test-only-signin-secret', signOptions: { expiresIn: '2h' } })
	const sign = vi.spyOn(jwt, 'signAsync')
	return { repository, auth: new AuthService(users, jwt), query, jwt, sign }
}

describe('登录精确查询与凭据验证', () => {
	it('用户名作为参数精确绑定，查询不存在返回 null', async () => {
		const { repository, query } = fixture([])
		const username = "someone%' OR 1=1 --"
		await expect(repository.findOneByUsername(username)).resolves.toBeNull()
		const [sql, parameters] = query.mock.calls[0]
		expect(sql).toContain('u.username = ?')
		expect(sql).not.toMatch(/LIKE|JOIN|COUNT|SELECT\s+\*/i)
		expect(sql).not.toContain(username)
		expect(parameters).toEqual([username])
		expect(query).toHaveBeenCalledOnce()
	})

	it.each([
		{ rows: [] },
		{ rows: [{ id: 18, username: 'student', password: 'wrong', isActive: 1 }] },
		{ rows: [{ id: 18, username: 'student', password: 'Study123', isActive: 0 }] },
		{ rows: [{ id: 18, username: 'student', password: null, isActive: 1 }] },
	])('无效凭据统一抛 401 且不签发 token：%j', async ({ rows }) => {
		const { auth, sign } = fixture(rows)
		await expect(auth.signin('student', 'Study123')).rejects.toBeInstanceOf(UnauthorizedException)
		expect(sign).not.toHaveBeenCalled()
	})

	it('经 UserService 传递用户名，签发可验证的 token 且无密码泄露', async () => {
		const { auth, query, jwt, sign } = fixture([
			{ id: 18, username: 'student', password: 'Study123', isActive: 1 },
		])
		const response = await auth.signin('student', 'Study123')
		expect(query.mock.calls[0][1]).toEqual(['student'])
		expect(sign).toHaveBeenCalledWith({ sub: 18, username: 'student' })
		expect(response).toMatchObject({ code: 200, data: { tokenType: 'Bearer' } })
		const payload = jwt.verify(response.data.accessToken)
		expect(payload).toMatchObject({ sub: 18, username: 'student' })
		expect(payload.exp - payload.iat).toBe(7200)
		expect(JSON.stringify({ response, payload })).not.toMatch(/password|Study123/)
	})
})
