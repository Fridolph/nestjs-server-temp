import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common'
import { PermissionsService } from './permissions.service.ts'
import { JwtGuard } from '../common/guards/jwt.guard.ts'
import { CaslGuard } from '../common/guards/casl.guard.ts'
import { Can, CheckPolicies } from '../common/decorators/casl.decorator.ts'
import { CaslAction } from '../common/constants/casl.ts'
import type { CaslRequest } from '../common/casl/casl.types.ts'
import { Permissions } from './permission.entity.ts'
import Logs from '../common/logs/logs.entity.ts'
import UserProfile from '../user/profile/profile.entity.ts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { updateProfileSchema, type UpdateProfileDto } from '../user/dto/update-profile.dto.ts'

@Controller('permissions')
@UseGuards(JwtGuard, CaslGuard)
export class PermissionsController {
	constructor(private readonly permissionsService: PermissionsService) {}

	/** 查看当前有效用户的授权快照，不要求先拥有权限目录的读取权限。 */
	@Get('me')
	@CheckPolicies(() => true)
	async me(@Req() request: CaslRequest) {
		const { permissions } = await request.authorization!
		return this.permissionsService.permissionResponse(permissions)
	}

	/** 测试日志读取权限，不查询日志内容。 */
	@Get('test/logs/read')
	@Can(CaslAction.Read, Logs)
	testRead() {
		return this.permissionsService.testResult('日志读取权限通过')
	}

	/** 测试日志导出权限，不生成文件。 */
	@Get('test/logs/export')
	@Can(CaslAction.Export, Logs)
	testExport() {
		return this.permissionsService.testResult('日志导出权限通过')
	}

	/** 测试日志删除权限，不执行删除。 */
	@Get('test/logs/delete')
	@Can(CaslAction.Delete, Logs)
	testDelete() {
		return this.permissionsService.testResult('日志删除权限通过，未执行删除')
	}

	/** 校验资料变更的每一个字段；仅为授权演示，不读取或更新实际资料。 */
	@Post('test/profile/update')
	@HttpCode(200)
	@Can(CaslAction.Update, UserProfile)
	async testFields(
		@Req() request: CaslRequest,
		@Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto
	) {
		const { ability } = await request.authorization!
		return this.permissionsService.testProfileFields(ability, request.user!.userId, dto)
	}

	/** 查询权限目录；普通日志角色不能仅凭日志权限查看授权配置。 */
	@Get()
	@Can(CaslAction.Read, Permissions)
	findAll() {
		return this.permissionsService.findAll()
	}

	/** 查询其他用户授权，目标 ID 不参与当前请求的身份或 Ability 构建。 */
	@Get(':userId')
	@Can(CaslAction.Read, Permissions)
	findPermissions(@Param('userId', ParseIntPipe) userId: number) {
		return this.permissionsService.findPermissionByUserId(userId)
	}
}
