import type { LoggerService } from '@nestjs/common'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import requestIp from 'request-ip'
import { QueryFailedError } from 'typeorm'

interface ValidationIssue {
	path: string
	code: string
	message: string
}

/** 统一 HTTP 错误协议，保留可公开的校验信息，隐藏 SQL 和服务端内部错误。 */
@Catch()
export class AllExceptionFilter implements ExceptionFilter {
	constructor(
		private readonly logger: LoggerService,
		private readonly httpAdapterHost: HttpAdapterHost
	) {}

	catch(exception: unknown, host: ArgumentsHost) {
		const { httpAdapter } = this.httpAdapterHost
		const ctx = host.switchToHttp()
		const request = ctx.getRequest()
		const response = ctx.getResponse()
		const path = httpAdapter.getRequestUrl(request).split('?')[0]
		let httpStatus: number = HttpStatus.INTERNAL_SERVER_ERROR
		let msg = '服务暂时不可用，请稍后重试'
		let errors: ValidationIssue[] | undefined
		let databaseCode: string | undefined

		if (exception instanceof QueryFailedError) {
			const driverError = exception.driverError as { code?: string } | undefined
			databaseCode = driverError?.code
			if (databaseCode === 'ER_DUP_ENTRY') {
				httpStatus = HttpStatus.CONFLICT
				msg = '数据已存在，请检查后重试'
			} else if (databaseCode === 'ER_ROW_IS_REFERENCED_2') {
				httpStatus = HttpStatus.CONFLICT
				msg = '数据仍有关联记录，无法删除或修改'
			} else if (databaseCode === 'ER_NO_REFERENCED_ROW_2') {
				httpStatus = HttpStatus.BAD_REQUEST
				msg = '关联的数据不存在，请检查后重试'
			}
		} else if (exception instanceof HttpException) {
			httpStatus = exception.getStatus()
			if (httpStatus < HttpStatus.INTERNAL_SERVER_ERROR) {
				const body = exception.getResponse()
				if (typeof body === 'string') {
					msg = body
				} else {
					const payload = body as { message?: unknown; errors?: unknown }
					if (typeof payload.message === 'string') {
						msg = payload.message
					} else if (Array.isArray(payload.message) && payload.message.every(item => typeof item === 'string')) {
						msg = payload.message.join('；')
					} else {
						msg = exception.message
					}
					if (httpStatus === HttpStatus.BAD_REQUEST && Array.isArray(payload.errors)) {
						errors = payload.errors.filter((issue): issue is ValidationIssue =>
							issue !== null && typeof issue === 'object'
							&& typeof issue.path === 'string'
							&& typeof issue.code === 'string'
							&& typeof issue.message === 'string'
						).map(({ path, code, message }) => ({ path, code, message }))
					}
				}
			}
		}

		httpAdapter.reply(response, {
			code: httpStatus,
			msg,
			timestamp: new Date().toISOString(),
			path,
			...(errors?.length ? { errors } : {}),
		}, httpStatus)

		// 不记录请求体、完整 headers 或 SQL 参数，避免密码和令牌进入日志。
		const metadata = {
			message: 'Request failed',
			code: httpStatus,
			path,
			method: request.method,
			ip: requestIp.getClientIp(request),
			errorType: exception instanceof Error ? exception.name : typeof exception,
			databaseCode,
			stack: httpStatus >= 500 && exception instanceof Error && !(exception instanceof QueryFailedError)
				? exception.stack : undefined,
		}
		if (httpStatus >= 500) this.logger.error(metadata)
		else this.logger.warn(metadata)
	}
}
