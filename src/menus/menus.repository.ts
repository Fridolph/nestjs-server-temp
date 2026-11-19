import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { Menus } from './menus.entity.ts'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { type CreateMenuDto, type UpdateMenuBodyDto } from './menus.dto.ts'

@Injectable()
export class MenusRpst {
	constructor(@InjectRepository(Menus) public repository: Repository<Menus>) {}

	async create(dto: CreateMenuDto) {
		const sql = `
      INSERT INTO menus (parentId, name, type, path, icon, \`order\`, visible, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
		const isCreated = await this.repository.query(sql, [
			dto.parentId,
			dto.menuName,
			dto.type,
			dto.path,
			dto.icon,
			dto.order,
			dto.visible,
			dto.enabled,
		])
		if (!isCreated?.affectedRows) throw new BadRequestException('创建失败')
		return true
	}

	async updateById(id: number, dto: UpdateMenuBodyDto) {
		const item = await this.repository.findOne({ where: { id } })
		if (!item) throw new NotFoundException('该菜单不存在')

		const isUpdated = await this.repository.update(id, {
			...(dto.icon === undefined ? {} : { icon: dto.icon }),
			...(dto.menuName === undefined ? {} : { name: dto.menuName }),
			...(dto.order === undefined ? {} : { order: dto.order }),
			...(dto.parentId === undefined ? {} : { parentId: dto.parentId }),
			...(dto.path === undefined ? {} : { path: dto.path }),
			...(dto.type === undefined ? {} : { type: dto.type }),
			...(dto.visible === undefined ? {} : { visible: dto.visible }),
			...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
		})
		if (!isUpdated.affected) throw new BadRequestException('更新失败')

		return true
	}
}
