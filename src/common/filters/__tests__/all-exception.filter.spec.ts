import { describe, expect, it, vi } from 'vitest'
import { BadRequestException, InternalServerErrorException, NotFoundException, type ArgumentsHost, type LoggerService } from '@nestjs/common'
import type { HttpAdapterHost } from '@nestjs/core'
import { QueryFailedError } from 'typeorm'
import { AllExceptionFilter } from '../all-exception.filter.ts'

function runFilter(exception: unknown) {
	const reply = vi.fn()
	const logger = { error: vi.fn(), warn: vi.fn() }
	const filter = new AllExceptionFilter(logger as unknown as LoggerService, {
		httpAdapter: { reply, getRequestUrl: () => '/users?token=private-token' },
	} as unknown as HttpAdapterHost)
	const request = { headers: { authorization: 'Bearer private-token' }, body: { password: 'secret' }, method: 'POST', socket: {} }
	const host = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }) }
	filter.catch(exception, host as unknown as ArgumentsHost)
	return { body: reply.mock.calls[0][1], status: reply.mock.calls[0][2], logger }
}

describe('统一错误协议', () => {
	it.each([
		['ER_DUP_ENTRY', 409],
		['ER_ROW_IS_REFERENCED_2', 409],
		['ER_NO_REFERENCED_ROW_2', 400],
		['ER_PARSE_ERROR', 500],
	])('映射数据库错误 %s 且不暴露内部信息', (code, status) => {
		const error = new QueryFailedError('INSERT secret SQL', ['private-password'], Object.assign(new Error('internal table details'), { code }))
		const result = runFilter(error)
		expect(result.status).toBe(status)
		expect(result.body.code).toBe(status)
		expect(JSON.stringify(result.body)).not.toMatch(/SQL|password|table details|token|stack/)
		expect(JSON.stringify(result.logger.error.mock.calls.concat(result.logger.warn.mock.calls))).not.toMatch(/private-password|private-token|authorization|table details/)
	})

	it('只保留公开的字段校验详情', () => {
		const result = runFilter(new BadRequestException({ message: '校验失败', errors: [
			{ path: 'nickname', code: 'invalid_type', message: '不能为空', input: 'private' },
			{ input: 'private' },
		] }))
		expect(result.body).toMatchObject({ code: 400, msg: '校验失败', errors: [{ path: 'nickname', code: 'invalid_type', message: '不能为空' }] })
		expect(result.logger.warn).toHaveBeenCalledOnce()
	})

	it('保留 404 的业务提示', () => {
		expect(runFilter(new NotFoundException('用户资料不存在')).body).toMatchObject({ code: 404, msg: '用户资料不存在' })
	})

	it('消息数组归一化为字符串', () => {
		expect(runFilter(new BadRequestException(['错误一', '错误二'])).body.msg).toBe('错误一；错误二')
	})

	it.each([new Error('internal secret'), new InternalServerErrorException('internal secret')])('服务端异常统一隐藏内部消息', exception => {
		const result = runFilter(exception)
		expect(result.body).toMatchObject({ code: 500, msg: '服务暂时不可用，请稍后重试' })
		expect(result.body).not.toHaveProperty('errors')
		expect(result.logger.error).toHaveBeenCalledOnce()
	})
})
