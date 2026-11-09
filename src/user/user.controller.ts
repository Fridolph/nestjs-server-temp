import type { QueryUserDto } from './user.types.ts'
import type { CreateUserDto } from './dto/create-user.dto.ts'
import { Body, Controller, Get, Post, Query, Delete, Param, ParseIntPipe } from '@nestjs/common'
import { UserService } from './user.service.ts'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.ts'
import { createUserSchema } from './dto/create-user.dto.ts'

@Controller('users')
export class UserController {
	constructor(private readonly userService: UserService) {}

	/**
	 * 分页查询启用用户及其资料、角色。
	 *
	 * @param query - URL 查询参数，由 Service 校验和归一化。
	 * @returns 用户列表与 pageMeta 分页信息。
	 */
	@Get()
	getUsers(@Query() query: QueryUserDto) {
		return this.userService.findAll(query)
	}

	/**
	 * 创建用户、非超管角色关联及默认资料。
	 *
	 * @param dto - 经 Zod 校验和归一化的创建数据。
	 * @returns 创建成功响应。
	 */
	@Post()
	addUser(@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto) {
		return this.userService.create(dto)
	}

	/**
	 * 硬删除用户及其资料。
	 *
	 * @param id - 经 ParseIntPipe 转换后的用户主键。
	 * @returns 删除成功响应。
	 */
	@Delete('/:id')
	removeUser(@Param('id', ParseIntPipe) id: number) {
		return this.userService.remove(id)
	}
}
