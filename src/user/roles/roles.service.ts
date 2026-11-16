import { Injectable } from '@nestjs/common'
import { RoleRpst } from './roles.repository.ts'
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto.ts'

/**
 * 角色业务编排。
 *
 * @remarks
 * Controller 负责路由、认证守卫和请求参数校验；Repository 负责查询、写入和数据库约束。
 * Service 只把 Repository 结果组装成统一的 code/data/msg 响应。
 * 超管权限由 SuperAdminGuard 校验，编码不可修改、系统角色保护和关联用户保护由 Repository 再次约束。
 */
@Injectable()
export class RolesService {
	constructor(private readonly roleRpst: RoleRpst) {}

	/** 查询全部角色，返回按角色 ID 升序排列的展示数据。 */
	async findAll() {
		return { code: 200, data: await this.roleRpst.findAllRoles() }
	}

	/**
	 * 创建角色。
	 * @param dto - 已通过 Zod 校验的角色名称、描述和唯一编码。
	 * @returns 新创建的角色记录和统一成功消息。
	 * @throws ConflictException - 角色编码已经存在。
	 * @throws ForbiddenException - 尝试创建 super_admin 角色。
	 */
	async createRole(dto: CreateRoleDto) {
		return { code: 200, data: await this.roleRpst.createRole(dto), msg: '角色创建成功' }
	}

	/**
	 * 修改角色的展示名称或描述。
	 * @remarks DTO 没有 roleCode 字段，因此授权编码不会进入更新链路。
	 * @param id - 目标角色主键。
	 * @param dto - 至少包含名称或描述之一的更新载荷。
	 * @returns 统一成功响应。
	 * @throws NotFoundException - 角色不存在。
	 * @throws ForbiddenException - 目标角色是 super_admin。
	 */
	async updateRoleInfo(id: number, dto: UpdateRoleDto) {
		await this.roleRpst.updateRoleById(id, dto)
		return { code: 200, data: true, msg: '角色信息已更新' }
	}

	/**
	 * 删除角色。
	 * @remarks Repository 在事务中检查角色存在性、系统角色保护和用户关联。
	 * @param id - 待删除角色主键。
	 * @returns 统一成功响应。
	 * @throws NotFoundException - 角色不存在。
	 * @throws ForbiddenException - 尝试删除 super_admin。
	 * @throws ConflictException - 角色仍被用户使用。
	 */
	async deleteRole(id: number) {
		await this.roleRpst.deleteRoleById(id)
		return { code: 200, data: true, msg: '角色删除成功' }
	}
}
