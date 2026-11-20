import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { CaslAction } from '../common/constants/casl.ts'
import { CaslResourceRegistry } from '../common/casl/casl-resource.registry.ts'
import type { CaslAuthorization, CaslRequest } from '../common/casl/casl.types.ts'
import { PermissionsService } from '../permissions/permissions.service.ts'

/** 将当前数据库授权转换成 CASL；资源注册表只解析资源，不负责授予权限。 */
@Injectable()
export class CaslAbilityService {
	constructor(
		private readonly permissionsService: PermissionsService,
		private readonly resources: CaslResourceRegistry
	) {}

	/** 同一请求内复用 Promise，Guard、Controller、Service 共用一次授权查询。 */
	forRequest(request: CaslRequest): Promise<CaslAuthorization> {
		if (!request.user || !Number.isSafeInteger(request.user.userId) || request.user.userId < 1) {
			throw new UnauthorizedException('请先登录')
		}
		request.authorization ??= this.createAuthorization(request.user.userId)
		return request.authorization
	}

	async createForUser(user: { userId: number }) {
		return (await this.createAuthorization(user.userId)).ability
	}

	private async createAuthorization(userId: number): Promise<CaslAuthorization> {
		const access = await this.permissionsService.getAccessForUser(userId)
		const { can, build } = new AbilityBuilder(createMongoAbility)
		if (access.isSuperAdmin) {
			// 超管仍需有效身份；只有可信角色分支能产生全资源通配规则。
			can(CaslAction.Manage, 'all')
		} else {
			for (const permission of access.permissions) {
				const target = this.resources.resolve(permission)
				if (permission.fields === null) can(permission.action, target)
				else can(permission.action, target, permission.fields)
			}
		}
		return {
			ability: build({ detectSubjectType: object => object.constructor }),
			permissions: access.isSuperAdmin
				? [this.permissionsService.superPermission()]
				: access.permissions,
		}
	}
}
