import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import { QueryFailedError, TypeORMError } from 'typeorm'

@Catch(TypeORMError)
export class TypeormFilter implements ExceptionFilter {
	catch(exception: any, host: ArgumentsHost) {
		const ctx = host.switchToHttp()
		let code = 500
		if (exception instanceof QueryFailedError) {
			code = exception.driverError.errno
		}
		const response = ctx.getResponse()
		response.status(500).json({
			code,
			timestamp: new Date().toISOString(),
			message: exception.message || 'Server Error',
		})
	}
}
