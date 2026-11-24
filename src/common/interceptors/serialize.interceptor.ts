import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Observable } from 'rxjs'

/** 输出转换的扩展点；禁止打印完整请求头或响应，避免泄露凭证。 */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle()
	}
}
