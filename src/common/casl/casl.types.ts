import type { AnyMongoAbility } from '@casl/ability'
import type { Request } from 'express'
import type { EffectivePermission } from '../../permissions/permissions.dto.ts'

export interface CaslAuthorization {
	ability: AnyMongoAbility
	permissions: EffectivePermission[]
}

/** 授权快照只属于当前请求；不缓存到单例 Service，避免用户间串用权限。 */
export interface CaslRequest extends Request {
	user?: { userId: number }
	authorization?: Promise<CaslAuthorization>
}
