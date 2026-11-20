import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CaslAbilityService } from '../../auth/casl.alibity.service.ts'
import { CHECK_POLICIES_KEY, type PolicyHandlerCallback } from '../decorators/casl.decorator.ts'
import type { CaslRequest } from '../casl/casl.types.ts'

/** 在 JwtGuard 之后执行；类级和方法级声明全部满足才放行。 */
@Injectable()
export class CaslGuard implements CanActivate {
	constructor(
		private readonly reflector: Reflector,
		private readonly caslService: CaslAbilityService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<CaslRequest>()
		if (!request.user || !Number.isSafeInteger(request.user.userId) || request.user.userId < 1) {
			throw new UnauthorizedException('请先登录')
		}
		const targets = [context.getHandler(), context.getClass()]
		const handlers = Object.values(CHECK_POLICIES_KEY).flatMap(
			key => this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(key, targets) ?? []
		)
		// 挂了授权 Guard 却忘写策略时默认拒绝；仅身份接口应显式声明 CheckPolicies(() => true)。
		if (!handlers.length) throw new ForbiddenException('接口未声明授权策略')
		const { ability } = await this.caslService.forRequest(request)
		if (!handlers.every(handler => handler(ability)))
			throw new ForbiddenException('没有执行该操作的权限')
		return true
	}
}
