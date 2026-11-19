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
	create(@Body(new ZodValidationPipe(createMenuSchema)) dto: CreateMenuDto) {
		return this.menusService.create(dto)
	}

	@Get()
	findAll() {
		return this.menusService.findAll()
	}

	@Patch(':id')
	@UseGuards(JwtGuard, AdminGuard)
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateMenuBodyBaseSchema)) dto: UpdateMenuBodyDto
	) {
		return this.menusService.update(id, dto)
	}

	@Delete(':id')
	@UseGuards(JwtGuard, AdminGuard)
	remove(@Param('id', ParseIntPipe) id: number) {
		return this.menusService.remove(id)
	}
}
