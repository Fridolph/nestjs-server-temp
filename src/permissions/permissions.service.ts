import {
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common'
import { z } from 'zod'
import type { AnyMongoAbility } from '@casl/ability'
import { assertUpdateFields } from '../common/casl/field-authorization.ts'
import UserProfile from '../user/profile/profile.entity.ts'
import type { UpdateProfileDto } from '../user/dto/update-profile.dto.ts'
import { CaslAction } from '../common/constants/casl.ts'
import { PermissionsRepository } from './permissions.repository.ts'
import { effectivePermissionSchema, type EffectivePermission } from './permissions.dto.ts'

/** MySQL JSON 可能返回数组或 JSON 文本；只解码 JSON，绝不猜测逗号分隔字段。 */
export function parseEffectivePermissions(rows: unknown[]): EffectivePermission[] {
	try {
		const decoded = rows.map(row => {
			if (!row || typeof row !== 'object') throw new Error('权限记录无效')
			const value = row as Record<string, unknown>
			if (typeof value.fields === 'string' && JSON.parse(value.fields) === null) {
				throw new Error('JSON null 不是不限字段标识，请使用 SQL NULL')
			}
			return {
				...value,
				fields: typeof value.fields === 'string' ? JSON.parse(value.fields) : value.fields,
			}
		})
		return z.array(effectivePermissionSchema).parse(decoded)
	} catch {
		throw new InternalServerErrorException('权限配置无效，请联系管理员')
	}
}

@Injectable()
export class PermissionsService {
	constructor(private readonly repository: PermissionsRepository) {}

	/** 使用当前有效角色；超管由角色编码识别，不接受普通权限表中的 all/manage 提权。 */
	async getAccessForUser(userId: number) {
		const rows = await this.repository.findUserAccess(userId)
		if (!rows.length) throw new NotFoundException('用户不存在')
		if (rows[0].isActive !== true && rows[0].isActive !== 1)
			throw new ForbiddenException('用户已停用')
		const isSuperAdmin = rows.some(row => row.roleCode === 'super_admin')
		const permissions = isSuperAdmin
			? []
			: parseEffectivePermissions(await this.repository.findEffectivePermissions(userId))
		return { isSuperAdmin, permissions }
	}

	/** 查询目标用户的权限数据；调用接口需另行通过查看其他用户权限的授权。 */
	async findPermissionByUserId(userId: number) {
		const access = await this.getAccessForUser(userId)
		return this.permissionResponse(
			access.isSuperAdmin ? [this.superPermission()] : access.permissions
		)
	}

	async findAll() {
		return { code: 200, data: await this.repository.findAll() }
	}

	/** 组装当前请求已有的授权快照，不为 /me 再执行一次数据库查询。 */
	permissionResponse(permissions: EffectivePermission[]) {
		return { code: 200, data: permissions }
	}

	superPermission(): EffectivePermission {
		return { code: 'all:manage', resource: 'all', action: CaslAction.Manage, fields: null }
	}

	/** 字段权限演示只使用当前身份构造资源，不读取或更新实际资料。 */
	testProfileFields(ability: AnyMongoAbility, userId: number, dto: UpdateProfileDto) {
		assertUpdateFields(ability, UserProfile, dto, { userId })
		return this.testResult('资料字段权限通过，未执行更新')
	}

	/** 学习接口只返回通过结果，不读取或修改实际业务数据。 */
	testResult(msg: string) {
		return { code: 200, data: true, msg }
	}
}
