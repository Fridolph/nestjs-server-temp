import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { map, Observable } from 'rxjs'

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
	intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
		const req = context.switchToHttp().getRequest()
		console.log('全局拦截器执行之前拿 req.headers\n', req.headers)
		return next.handle().pipe(
			map(data => {
				console.log('全局拦截器执行之后的 response\n', data)
				return data
			})
		)
	}
}
