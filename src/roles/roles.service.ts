import { Injectable } from '@nestjs/common'
import { RolesRpst } from './roles.repository.ts'
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto.ts'

@Injectable()
export class RolesService {
	constructor(private readonly rolesRpst: RolesRpst) {}

	/** 创建角色并返回保存后的展示信息。 */
	async create(dto: CreateRoleDto) {
		const newRole = await this.rolesRpst.createRole(dto)
		return {
			code: 200,
			data: newRole,
			msg: '成功创建新角色',
		}
	}

	/** 查询全部角色。 */
	async findAll() {
		const data = await this.rolesRpst.findAllRoles()
		return { code: 200, data }
	}

	/** 查询指定角色，不存在时由仓库抛出 404。 */
	async findOne(id: number) {
		return { code: 200, data: await this.rolesRpst.findRoleById(id) }
	}

	/** 更新角色的可变资料，系统角色保护由仓库执行。 */
	async update(id: number, dto: UpdateRoleDto) {
		await this.rolesRpst.updateRoleById(id, dto)
		return { code: 200, data: true, msg: '修改角色信息成功' }
	}

	/** 删除未被使用的角色。 */
	async remove(id: number) {
		await this.rolesRpst.deleteRoleById(id)
		return {
			code: 200,
			data: true,
			msg: '角色删除成功',
		}
	}
}
