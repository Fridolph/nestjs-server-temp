import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Permissions } from './permission.entity.ts'
import type { CreatePermissionDto, UpdatePermissionDto } from './permissions.dto.ts'

export interface UserAccessRow {
	userId: number
	isActive: number | boolean
	roleCode: string | null
}

/** 返回持久化数据；权限配置的解析、有效用户判断和接口响应交给上层。 */
@Injectable()
export class PermissionsRepository {
	constructor(@InjectRepository(Permissions) public repository: Repository<Permissions>) {}

	/** LEFT JOIN 保留无角色用户，用于区分“不存在”与“没有权限”；角色以数据库当前值为准。 */
	findUserAccess(userId: number) {
		return this.repository.query<UserAccessRow[]>(
			`
			SELECT u.id AS userId, u.isActive, r.code AS roleCode
			FROM \`user\` AS u
			LEFT JOIN roles AS r ON r.id = u.roleId
			WHERE u.id = ?
		`,
			[userId]
		)
	}

	/**
	 * 读取唯一角色的允许权限，SQL 去重；禁用权限不参与授权。
	 * JSON 转文本以区分 SQL NULL 与 JSON null，后者必须报配置错误而不是扩大权限。
	 */
	findEffectivePermissions(userId: number) {
		return this.repository.query<unknown[]>(
			`
			SELECT DISTINCT p.code, p.resource, p.action, CAST(p.fields AS CHAR) AS fields
			FROM user AS u
			INNER JOIN roles_permissions AS rp ON rp.roleId = u.roleId
			INNER JOIN permissions AS p ON p.id = rp.permissionId
			WHERE u.id = ? AND p.enabled = 1
			ORDER BY p.code
		`,
			[userId]
		)
	}

	findAll() {
		// Entity 读取会归一化 JSON、布尔值和时间，供输出 schema 校验。
		return this.repository.find({ order: { resource: 'ASC', id: 'ASC' } })
	}

	/** 持久化新权限；唯一编码冲突由 Service 统一转换为 409。 */
	createPermission(dto: CreatePermissionDto) {
		const sql = `
			INSERT INTO permissions (code, name, resource, action, enabled, fields)
			VALUES (?, ?, ?, ?, ?, ?)
		`
		return this.repository
			.query(sql, [
				dto.code,
				dto.name,
				dto.resource,
				dto.action,
				dto.enabled,
				dto.fields === null ? null : JSON.stringify(dto.fields),
			])
			.then(() => this.findByCode(dto.code))
	}

	/** 原生 SQL 创建的学习对照版；业务创建路径采用实体 save。 */
	async createPermissionByEntity(dto: CreatePermissionDto) {
		return this.repository.save(this.repository.create(dto))
	}

	/** 按主键读取目录记录，用于区分目标不存在与重复提交。 */
	findById(id: number) {
		return this.repository.findOneBy({ id })
	}

	findByCode(code: string) {
		return this.repository.findOneBy({ code })
	}

	/** 只更新目录字段，不修改主键或稳定权限编码。 */
	updatePermission(id: number, dto: UpdatePermissionDto) {
		return this.repository.update(id, dto)
	}

	/**
	 * 锁定目标后检查角色关联并删除，避免检查与删除之间新增关联。
	 * @remarks 同一事务 manager 完成读写；已关联时拒绝删除，防止级联静默撤销授权。
	 */
	async removeUnassignedPermission(id: number): Promise<'deleted' | 'assigned' | 'missing'> {
		return this.repository.manager.transaction(async manager => {
			const repository = manager.getRepository(Permissions)
			const current = await repository.findOne({
				where: { id },
				lock: { mode: 'pessimistic_write' },
			})
			if (!current) return 'missing'
			const rows = await manager.query<{ count: number | string }[]>(
				'SELECT COUNT(*) AS count FROM roles_permissions WHERE permissionId = ?',
				[id]
			)
			if (Number(rows[0]?.count ?? 0) > 0) return 'assigned'
			const result = await repository.delete(id)
			return result.affected ? 'deleted' : 'missing'
		})
	}
}
