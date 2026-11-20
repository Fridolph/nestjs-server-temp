import type { CreateMenuDto, MenuDto, UpdateMenuBodyDto } from './menus.dto.ts'
import { Injectable, NotFoundException } from '@nestjs/common'
import { MenusRpst } from './menus.repository.ts'

@Injectable()
export class MenusService {
	constructor(private menusRpst: MenusRpst) {}

	async create(dto: CreateMenuDto) {
		await this.menusRpst.create(dto)
		return { code: 200, data: true, msg: '创建新菜单' }
	}

	async findAll() {
		const sql = `SELECT * FROM menus ORDER BY \`order\`, id`
		const data = await this.menusRpst.repository.query(sql)
		return { code: 200, data }
	}

	/**
	 * 查询用户id 对应的权限菜单列表
	 * @param userId number
	 */
	async findWithRoleId(userId: number) {
		const sql = `
    SELECT DISTINCT m.*
    FROM users_roles AS ur
    INNER JOIN roles_menus AS rm
      ON rm.rolesId = ur.roleIds
    INNER JOIN menus AS m
      ON m.id = rm.menusId
    WHERE ur.userId = ?
    ORDER BY m.\`order\` ASC, m.id ASC;`
		return await this.menusRpst.repository.query<MenuDto[]>(sql, [userId])
	}

	async update(id: number, dto: UpdateMenuBodyDto) {
		// await this.menusRpst.updateById(id, dto)
		return await this.menusRpst.updateById(id, dto)
	}

	async remove(id: number) {
		const sql = `DELETE FROM menus WHERE id = ?`
		const isDeleted = await this.menusRpst.repository.query(sql, [id])
		if (!isDeleted.affectedRows) throw new NotFoundException('未找到该菜单项')
		return { code: 200, data: true, msg: '成功删除菜单项' }
	}
}
