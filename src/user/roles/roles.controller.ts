import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common'
import { RolesService } from './roles.service.ts'
import { JwtGuard } from '../../guard/jwt.guard.ts'
import { SuperAdminGuard } from '../../guard/super-admin.guard.ts'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.ts'
import {
	createRoleSchema,
	type CreateRoleDto,
	type UpdateRoleDto,
	updateRoleSchema,
} from './roles.dto.ts'

@Controller('users/roles')
@UseGuards(JwtGuard)
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}
	/** 所有已登录用户可读取角色，用于展示和选择角色。 */
	@Get()
	getAllRoles() {
		return this.rolesService.findAll()
	}
	/** 只有超管可以创建角色。 */
	@Post()
	@UseGuards(SuperAdminGuard)
	createRole(@Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto) {
		return this.rolesService.createRole(dto)
	}
	/** 只有超管可以编辑角色；roleCode 不在更新 DTO 中，因此不可修改。 */
	@Patch(':id')
	@UseGuards(SuperAdminGuard)
	updateRole(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateRoleSchema)) dto: UpdateRoleDto
	) {
		return this.rolesService.updateRoleInfo(id, dto)
	}
	/** 只有超管可以删除角色；仓库会额外拒绝删除超管或仍被使用的角色。 */
	@Delete(':id')
	@UseGuards(SuperAdminGuard)
	deleteRole(@Param('id', ParseIntPipe) id: number) {
		return this.rolesService.deleteRole(id)
	}
}
