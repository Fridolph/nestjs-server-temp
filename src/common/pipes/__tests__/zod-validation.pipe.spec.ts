import { BadRequestException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ZodValidationPipe } from '../zod-validation.pipe.ts'

describe('ZodValidationPipe', () => {
	it('返回解析后的数据，不修改原始请求对象', () => {
		const pipe = new ZodValidationPipe(z.strictObject({ nickname: z.string().trim() }))
		const payload = { nickname: '  小明  ' }

		expect(pipe.transform(payload)).toEqual({ nickname: '小明' })
		expect(payload.nickname).toBe('  小明  ')
	})

	it('支持 Schema 的输出类型与输入类型不同', () => {
		const pipe = new ZodValidationPipe(z.string().transform(value => value.length))

		expect(pipe.transform('hello')).toBe(5)
	})

	it('将校验失败转换成包含字段路径的 HTTP 400 异常', () => {
		const pipe = new ZodValidationPipe(z.strictObject({ nickname: z.string() }))
		let caught: unknown

		try {
			pipe.transform({ nickname: null })
		} catch (error) {
			caught = error
		}

		expect(caught).toBeInstanceOf(BadRequestException)
		const exception = caught as BadRequestException
		expect(exception.getStatus()).toBe(400)
		expect(exception.getResponse()).toEqual({
			statusCode: 400,
			message: '请求参数校验失败',
			errors: [expect.objectContaining({ path: 'nickname', code: 'invalid_type' })],
		})
	})

	it('将请求体整体的校验错误标记为根路径', () => {
		const pipe = new ZodValidationPipe(z.strictObject({ nickname: z.string() }))

		try {
			pipe.transform(null)
			expect.unreachable('无效请求不应通过校验')
		} catch (error) {
			expect(error).toBeInstanceOf(BadRequestException)
			expect((error as BadRequestException).getResponse()).toEqual(
				expect.objectContaining({
					errors: [expect.objectContaining({ path: '$' })],
				})
			)
		}
	})
})
