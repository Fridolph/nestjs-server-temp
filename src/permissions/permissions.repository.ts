import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Permissions } from './permission.entity.ts'

export interface UserAccessRow {
	userId: number
	isActive: number | boolean
	roleCode: string | null
}

/** 返回持久化数据；权限配置的解析、有效用户判断和接口响应交给上层。 */
@Injectable()
export class PermissionsRepository {
	constructor(
		@InjectRepository(Permissions) private readonly repository: Repository<Permissions>
	) {}

	/** LEFT JOIN 保留无角色用户，用于区分“不存在”与“没有权限”；角色以数据库当前值为准。 */
	findUserAccess(userId: number) {
		return this.repository.query<UserAccessRow[]>(
			`
			SELECT u.id AS userId, u.isActive, r.code AS roleCode
			FROM \`user\` AS u
			LEFT JOIN users_roles AS ur ON ur.userId = u.id
			LEFT JOIN roles AS r ON r.id = ur.roleId
			WHERE u.id = ?
		`,
			[userId]
		)
	}

	/**
	 * 多角色取允许权限并集，SQL 去重；禁用权限不参与授权。
	 * JSON 转文本以区分 SQL NULL 与 JSON null，后者必须报配置错误而不是扩大权限。
	 */
	findEffectivePermissions(userId: number) {
		return this.repository.query<unknown[]>(
			`
			SELECT DISTINCT p.code, p.resource, p.action, CAST(p.fields AS CHAR) AS fields
			FROM users_roles AS ur
			INNER JOIN roles_permissions AS rp ON rp.roleId = ur.roleId
			INNER JOIN permissions AS p ON p.id = rp.permissionId
			WHERE ur.userId = ? AND p.enabled = 1
			ORDER BY p.code
		`,
			[userId]
		)
	}

	findAll() {
		return this.repository.find({ order: { id: 'ASC' } })
	}
}
