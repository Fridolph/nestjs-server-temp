import type { UpdateProfileDto } from '../dto/update-profile.dto.ts'
import {
	Body,
	Controller,
	Get,
	Headers,
	Param,
	ParseIntPipe,
	Patch,
	UseGuards,
} from '@nestjs/common'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.ts'
import { updateProfileSchema } from '../dto/update-profile.dto.ts'
import { ProfileService } from './profile.service.ts'
import { AdminGuard } from '../../guard/admin.guard.ts'
import { AuthGuard } from '@nestjs/passport'
import { SelfOrSuperGuard } from '../../guard/self-or-super.guard.ts'
import { JwtGuard } from '../../guard/jwt.guard.ts'

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
	// 装饰器的执行顺序：方法装饰器若有多个，从下往上执行
	// 若用方法，则是从左到右依次执行，前面没通过后面不会执行
	@UseGuards(AuthGuard('jwt'), AdminGuard)
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
	@UseGuards(JwtGuard, SelfOrSuperGuard)
	updateUserProfile(
		@Param('id', ParseIntPipe) id: number,
		@Body(new ZodValidationPipe(updateProfileSchema)) updateProfileDto: UpdateProfileDto
	) {
		return this.profileService.updateProfile(id, updateProfileDto)
	}
}
