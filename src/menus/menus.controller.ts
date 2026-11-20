import {
	type UpdateMenuBodyDto,
	type CreateMenuDto,
	createMenuSchema,
	updateMenuBodyBaseSchema,
} from './menus.dto.ts'
import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	ParseIntPipe,
	UseGuards,
} from '@nestjs/common'
import { MenusService } from './menus.service.js'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { JwtGuard } from '../common/guards/jwt.guard.ts'
import { RolesGuard } from '../common/guards/roles.guard.ts'
import { Roles } from '../common/decorators/roles.decorator.ts'
import { AdminGuard } from '../common/guards/admin.guard.ts'

@Controller('menus')
export class MenusController {
	constructor(private readonly menusService: MenusService) {}

	@Post()
	@Roles('premium', 'guest')
	@UseGuards(JwtGuard, RolesGuard)
	// @UseGuards(JwtGuard, AdminGuard)
	async create(@Body(new ZodValidationPipe(createMenuSchema)) dto: CreateMenuDto) {
		await this.menusService.create(dto)
		return { code: 200, data: true, msg: '创建新菜单' }
	}

	@Get()
	async findAll() {
		const data = await this.menusService.findAll()
		return { code: 200, data }
	}

	@Patch(':id')
	@UseGuards(JwtGuard, AdminGuard)
	async update(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateMenuBodyBaseSchema)) dto: UpdateMenuBodyDto
	) {
		const isUpdated = await this.menusService.update(id, dto)
		return { code: 200, data: isUpdated, msg: '成功更新菜单信息' }
	}

	@Delete(':id')
	@UseGuards(JwtGuard, AdminGuard)
	async remove(@Param('id', ParseIntPipe) id: number) {
		const isRemoved = await this.menusService.removeById(id)
		return { code: 200, data: isRemoved, msg: '成功删除菜单项' }
	}
}
