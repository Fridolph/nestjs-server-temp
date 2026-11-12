import type { UpdateProfileDto } from '../dto/update-profile.dto.ts'
import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.ts'
import { updateProfileSchema } from '../dto/update-profile.dto.ts'
import { ProfileService } from './profile.service.ts'
import { AuthGuard } from '@nestjs/passport'

@Controller()
export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	/**
	 * 查询指定启用用户的资料。
	 *
	 * @param userId - 路径中的用户主键，经 ParseIntPipe 转换为整数。
	 * @returns 包含用户基本信息与单个资料对象的响应。
	 */
	@Get('users/:userId/profile')
	@UseGuards(AuthGuard('jwt'))
	getUserProfile(@Param('userId', ParseIntPipe) userId: number) {
		return this.profileService.getUserProfile(userId)
	}

	/**
	 * 仅更新请求提供的资料字段。
	 *
	 * @param id - 经 ParseIntPipe 转换后的用户主键。
	 * @param updateProfileDto - 经 Zod 校验和归一化的更新数据。
	 * @returns 更新成功响应。
	 */
	@Patch('users/:id/profile')
	updateUserProfile(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateProfileSchema)) updateProfileDto: UpdateProfileDto
	) {
		return this.profileService.updateProfile(id, updateProfileDto)
	}
}
