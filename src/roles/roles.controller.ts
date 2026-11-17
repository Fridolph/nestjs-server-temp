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
import { RolesService } from './roles.service.ts'
import {
	createRoleSchema,
	updateRoleSchema,
	type UpdateRoleDto,
	type CreateRoleDto,
} from './roles.dto.ts'
import { JwtGuard } from '../common/guard/jwt.guard.ts'
import { AdminGuard } from '../common/guard/admin.guard.ts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'

// 迁移期间保留旧路径，已有前端请求与新路径共用同一套权限和校验。
@Controller(['roles', 'users/roles'])
@UseGuards(JwtGuard)
export class RolesController {
	constructor(private readonly rolesService: RolesService) {}

	/** 超管或管理员创建非系统保留角色。 */
	@Post()
	@UseGuards(AdminGuard)
	create(@Body(new ZodValidationPipe(createRoleSchema)) createRoleDto: CreateRoleDto) {
		return this.rolesService.create(createRoleDto)
	}

	/** 查询角色列表，供已登录用户展示和选择角色。 */
	@Get()
	findAll() {
		return this.rolesService.findAll()
	}

	/** 查询单个角色的展示信息。 */
	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.rolesService.findOne(id)
	}

	/** 超管或管理员更新角色名称与描述，授权编码保持不变。 */
	@Patch(':id')
	@UseGuards(AdminGuard)
	update(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateRoleSchema)) updateRoleDto: UpdateRoleDto
	) {
		return this.rolesService.update(id, updateRoleDto)
	}

	/** 超管或管理员删除未被使用的非超管角色。 */
	@Delete(':id')
	@UseGuards(AdminGuard)
	remove(@Param('id', ParseIntPipe) id: number) {
		return this.rolesService.remove(id)
	}
}
