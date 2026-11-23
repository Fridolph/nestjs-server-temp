import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common'
import { z } from 'zod'
import type { AnyMongoAbility } from '@casl/ability'
import { assertUpdateFields } from '../common/casl/field-authorization.ts'
import UserProfile from '../user/profile/profile.entity.ts'
import type { Permissions } from './permission.entity.ts'
import type { UpdateProfileDto } from '../user/dto/update-profile.dto.ts'
import { CaslAction } from '../common/constants/casl.ts'
import { PermissionsRepository } from './permissions.repository.ts'
import {
	effectivePermissionSchema,
	permissionSchema,
	type CreatePermissionDto,
	type EffectivePermission,
	type PermissionGroup,
	type UpdatePermissionDto,
} from './permissions.dto.ts'
import { CaslResourceRegistry } from '../common/casl/casl-resource.registry.ts'

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
	constructor(
		private readonly rpst: PermissionsRepository,
		private readonly casl: CaslResourceRegistry
	) {}

	/** 使用当前有效角色；超管由角色编码识别，不接受普通权限表中的 all/manage 提权。 */
	async getAccessForUser(userId: number) {
		const rows = await this.rpst.findUserAccess(userId)
		if (!rows.length) throw new NotFoundException('用户不存在')
		if (rows[0].isActive !== true && rows[0].isActive !== 1)
			throw new ForbiddenException('用户已停用')
		const isSuperAdmin = rows.some(row => row.roleCode === 'super_admin')
		const permissions = isSuperAdmin
			? []
			: parseEffectivePermissions(await this.rpst.findEffectivePermissions(userId))
		return { isSuperAdmin, permissions }
	}

	/** 查询目标用户的权限数据；调用接口需另行通过查看其他用户权限的授权。 */
	async findPermissionByUserId(userId: number) {
		const access = await this.getAccessForUser(userId)
		return this.permissionResponse(
			access.isSuperAdmin ? [this.superPermission()] : access.permissions
		)
	}

	/** 返回按资源分组的完整目录；包含停用项，供管理端独立维护各条权限。 */
	async findAll() {
		const rows = await this.rpst.findAll()
		return { code: 200, data: this.groupPermissions(rows) }
	}

	/** 将同一资源的逐动作权限聚合为管理端一行，同时保留每项权限的独立 ID。 */
	private groupPermissions(rows: Permissions[]): PermissionGroup[] {
		const groups = new Map<string, PermissionGroup>()
		for (const row of rows) {
			const permission = this.toPermissionDto(row)
			const group: PermissionGroup = groups.get(row.resource) ?? {
				resource: row.resource,
				name: this.casl.label(row.resource),
				actions: [],
				permissions: [],
			}
			if (!group.actions.includes(row.action)) group.actions.push(row.action)
			group.permissions.push(permission)
			groups.set(row.resource, group)
		}
		return [...groups.values()]
	}

	/** 将 ORM 实体投影为权限目录公开 DTO，排除 role 等关联字段。 */
	private toPermissionDto(row: Permissions) {
		return permissionSchema.parse({
			id: row.id,
			code: row.code,
			name: row.name,
			resource: row.resource,
			action: row.action,
			enabled: row.enabled,
			fields: row.fields,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		})
	}

	/** 创建权限目录记录，并验证 resource/action/fields 与 CASL 资源注册表一致。 */
	async create(dto: CreatePermissionDto) {
		const validated = dto
		this.casl.resolve(
			{
				code: validated.code,
				resource: validated.resource,
				action: validated.action,
				fields: validated.fields,
			},
			() => new BadRequestException('资源、动作或字段范围无效')
		)
		try {
			const data = await this.rpst.createPermission(validated)
			return { code: 200, data: this.toPermissionDto(data!), msg: '权限创建成功' }
		} catch (error) {
			if (this.isDuplicateKey(error)) throw new ConflictException('权限编码已存在')
			throw error
		}
	}

	/** 更新权限目录；编码保持不变，并按合并后的完整配置重新校验 CASL 资源。 */
	async update(id: number, dto: UpdatePermissionDto) {
		const current = await this.rpst.findById(id)
		if (!current) throw new NotFoundException('权限不存在')
		const next = {
			code: current.code,
			name: dto.name ?? current.name,
			resource: dto.resource ?? current.resource,
			action: dto.action ?? current.action,
			enabled: dto.enabled ?? current.enabled,
			fields: dto.fields === undefined ? current.fields : dto.fields,
		}
		this.casl.resolve(
			{ code: next.code, resource: next.resource, action: next.action, fields: next.fields },
			() => new BadRequestException('资源、动作或字段范围无效')
		)
		await this.rpst.updatePermission(id, dto)
		const data = await this.rpst.findById(id)
		if (!data) throw new NotFoundException('权限不存在')
		return { code: 200, data: this.toPermissionDto(data), msg: '权限更新成功' }
	}

	/** 删除未被角色使用的权限，避免删除操作静默撤销现有授权。 */
	async remove(id: number) {
		const result = await this.rpst.removeUnassignedPermission(id)
		if (result === 'assigned') throw new ConflictException('该权限仍被角色使用，请先解除角色关联')
		if (result === 'missing') throw new NotFoundException('权限不存在')
		return { code: 200, data: true, msg: '权限删除成功' }
	}

	private isDuplicateKey(error: unknown): boolean {
		if (typeof error !== 'object' || error === null) return false
		const candidate = error as { code?: unknown; driverError?: { code?: unknown } }
		return candidate.code === 'ER_DUP_ENTRY' || candidate.driverError?.code === 'ER_DUP_ENTRY'
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
