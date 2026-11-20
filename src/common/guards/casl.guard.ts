import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
// import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core'
import { CaslAbilityService } from '../../auth/casl.alibity.service.ts'
import {
	CaslHandlerType,
	CHECK_POLICIES_KEY,
	PolicyHandlerCallback,
} from '../decorators/casl.decorator.ts'

@Injectable()
export class CaslGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly caslService: CaslAbilityService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const handlers = this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(
			CHECK_POLICIES_KEY.Handler,
			[context.getHandler(), context.getClass()]
		)
		const canHandlers = this.reflector.getAllAndMerge<any[]>(CHECK_POLICIES_KEY.Can, [
			context.getHandler(),
			context.getClass(),
		]) as CaslHandlerType
		const cannotHandlers = this.reflector.getAllAndMerge<any[]>(CHECK_POLICIES_KEY.Cannot, [
			context.getHandler(),
			context.getClass(),
		]) as CaslHandlerType

		// 若用户未设置上述任意一个 handler 则返回true
		if (!handlers || !canHandlers || !cannotHandlers) return true

		// 获取当前用户权限 以便后续逻辑判断
		const req = context.switchToHttp().getRequest()
		if (req?.user) {
			const ability = await this.caslService.forRoot(req.user)
			let flag = true
			if (handlers) {
				flag = flag && handlers.every(handler => handler(ability))
			}
			if (flag && canHandlers) {
				if (canHandlers instanceof Array) {
					flag = flag && canHandlers.every(handler => handler(ability))
				} else if (typeof canHandlers === 'function') {
					flag = flag && canHandlers(ability)
				}
			}
			if (flag && cannotHandlers) {
				if (cannotHandlers instanceof Array) {
					flag = flag && cannotHandlers.every(handler => handler(ability))
				} else if (typeof canHandlers === 'function') {
					flag = flag && cannotHandlers(ability)
				}
			}
			return flag
		} else {
			return false
		}
	}
}
