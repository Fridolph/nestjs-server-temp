import type { LoggerService } from '@nestjs/common'
import type { CreateUserDto, QueryUserDto } from './user.types.ts'
import { Body, Controller, Get, Post, Inject, Query } from '@nestjs/common'
import { UserService } from './user.service.ts'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'

@Controller('users')
export class UserController {
	constructor(
		private readonly userService: UserService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
	) {
		// this.logger.log('User 模块初始化')
	}

	@Get()
	getUsers(@Query() query: QueryUserDto) {
		// 前端传递的所有参数全是 string 类型，需要进行对应转换
		// console.log('🚀 getUsers ~ query:', query)
		return this.userService.findAll(query)
	}

	@Post()
	addUser(@Body() dto: CreateUserDto) {
		console.log('🚀 ~ :25 ~ UserController ~ addUser ~ dto:', dto)
		return this.userService.create(dto)
	}
}
