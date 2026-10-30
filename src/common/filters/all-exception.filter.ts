import type { LoggerService } from '@nestjs/common'
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import requestIp from 'request-ip'
import { QueryFailedError } from 'typeorm'

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
	constructor(
		private readonly logger: LoggerService,
		private readonly httpAdapterHost: HttpAdapterHost
	) {}

	catch(exception: any, host: ArgumentsHost) {
		console.log('🚀 AllExceptionFilter ~ catch ~ exception:')
		const { httpAdapter } = this.httpAdapterHost
		const ctx = host.switchToHttp()
		const request = ctx.getRequest()
		const response = ctx.getResponse()

		const httpStatus =
			exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

		// 加入更多异常错误逻辑
		let msg: string = exception['response'] || 'Internal Server Error'
		if (exception instanceof QueryFailedError) {
			msg = exception.message
		}

		// 返回给客户端的（不放 headers/内部细节）
		const responseBody = {
			statusCode: httpStatus,
			timestamp: new Date().toISOString(),
			path: httpAdapter.getRequestUrl(request),
			message: exception instanceof HttpException ? exception.message : 'Internal Server Error',
		}
		httpAdapter.reply(response, responseBody, httpStatus) // 只发一次

		// 记给 winston 的结构化 meta
		this.logger.error({
			message: 'Unhandled exception',
			statusCode: httpStatus,
			path: request.url,
			method: request.method,
			ip: requestIp.getClientIp(request),
			headers: request.headers,
			exception: exception instanceof Error ? exception.message : String(exception),
			stack: exception instanceof Error ? exception.stack : undefined,
		})
	}
}
