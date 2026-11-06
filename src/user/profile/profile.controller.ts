import type { UpdateProfileDto } from './dto/update-profile.dto.ts'
import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.ts'
import { updateProfileSchema } from './dto/update-profile.dto.ts'
import { ProfileService } from './profile.service.ts'

@Controller()
export class ProfileController {
	/**
	 * 初始化用户资料接口控制器。
	 *
	 * @param profileService - 用户资料查询服务。
	 */
	constructor(private readonly profileService: ProfileService) {}

	/**
	 * 处理 GET /users/:id/profile，查询指定启用用户的资料。
	 *
	 * @param id - 路径中的用户主键，经 ParseIntPipe 转换为整数。
	 * @returns 包含用户名和资料的响应；未匹配到数据时 data 为空数组。
	 * @throws BadRequestException - 路径参数不能由 ParseIntPipe 解析为整数。
	 */
	@Get('users/:id/profile')
	getUserProfile(@Param('id', ParseIntPipe) id: number) {
		return this.profileService.getProfile(id)
	}

	/**
	 * 校验资料 PATCH 请求，并仅更新请求中提供的字段。
	 *
	 * @remarks
	 * 请求体由 Zod 管道校验，昵称会去除首尾空白，额外字段会被拒绝。
	 * 服务会查询其他用户的同名昵称；并发唯一约束、资料存在性和权限检查仍待完善。
	 *
	 * @param id - 经 ParseIntPipe 转换后的用户主键。
	 * @param updateProfileDto - 经过 Schema 校验与转换的资料更新数据。
	 * @returns 用户资料服务返回的更新结果。
	 * @throws BadRequestException - 路径参数不是整数，或请求体不满足更新规则。
	 * @throws ConflictException - 昵称已被其他用户使用。
	 */
	@Patch('users/:id/profile')
	updateUser(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateProfileSchema)) updateProfileDto: UpdateProfileDto
	) {
		return this.profileService.updateProfile(id, updateProfileDto)
	}
}
