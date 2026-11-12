import 'reflect-metadata'
import { BadRequestException } from '@nestjs/common'
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { describe, expect, it, vi } from 'vitest'
import { AuthController } from '../auth.controller.ts'
import { AuthService } from '../auth.service.ts'
import type { JwtService } from '@nestjs/jwt'
import type { UserService } from '../../user/user.service.ts'
import type { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.ts'
import type { registerSchema } from '../dto/register.dto.ts'

function fixture() {
	const create = vi.fn().mockResolvedValue({ code: 200, data: true })
	const service = new AuthService({ register: create } as unknown as UserService, {} as JwtService)
	const controller = new AuthController(service)
	const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, AuthController, 'register') as
		Record<string, { pipes: ZodValidationPipe<typeof registerSchema>[] }>
	const pipe = Object.values(metadata)[0].pipes[0]
	return { create, register: (body: unknown) => controller.register(pipe.transform(body)) }
}

describe('注册入口参数边界', () => {
	it.each([3, '3', [], [3], [1, 2]])('拒绝客户端角色参数 %j，不能进入用户创建事务', roleIds => {
		const { create, register } = fixture()
		expect(() => register({ username: 'alice', password: 'secret123', roleIds }))
			.toThrow(BadRequestException)
		expect(create).not.toHaveBeenCalled()
	})

	it('无需角色参数，归一化用户名后交给专用注册方法', async () => {
		const { create, register } = fixture()
		await expect(register({ username: ' alice ', password: 'secret123' }))
			.resolves.toEqual({ code: 200, data: true })
		expect(create).toHaveBeenCalledWith({ username: 'alice', password: 'secret123' })
	})
})
