import type { LoggerService } from '@nestjs/common'
import type { CreateUserDto, QueryUserDto, UpdateUserDto } from './user.types.ts'
import {
	Body,
	Controller,
	Get,
	Post,
	Inject,
	Query,
	UseFilters,
	Delete,
	Param,
	Patch,
} from '@nestjs/common'
import { UserService } from './user.service.ts'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { TypeormFilter } from '../common/filters/typeorm.filter.ts'

@Controller('users')
@UseFilters(new TypeormFilter())
export class UserController {
	/**
	 * 初始化用户接口控制器。
	 *
	 * @param userService - 提供用户查询、创建及删除能力的服务。
	 * @param logger - Nest 集成的 Winston 日志服务。
	 */
	constructor(
		private readonly userService: UserService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
	) {
		// this.logger.log('User 模块初始化')
	}

	/**
	 * 处理 GET /users，分页查询符合条件的启用用户及其资料。
	 *
	 * @param query - URL 查询参数，由用户服务解析和检查分页参数。
	 * @returns 包含用户列表、匹配总数和分页信息的响应。
	 * @throws BadRequestException - 用户服务检测到无效分页参数或用户名类型。
	 */
	@Get()
	getUsers(@Query() query: QueryUserDto) {
		// 前端传递的所有参数全是 string 类型，需要进行对应转换
		// console.log('🚀 getUsers ~ query:', query)
		return this.userService.findAll(query)
	}

	/**
	 * 处理 POST /users，创建用户及其默认资料。
	 *
	 * @param dto - 请求体中的用户创建数据。
	 * @returns 用户服务返回的创建成功响应。
	 * @throws ConflictException - 用户服务查询发现用户名已被使用。
	 */
	@Post()
	addUser(@Body() dto: CreateUserDto) {
		// console.log('🚀 ~ :25 ~ UserController ~ addUser ~ dto:', dto)
		return this.userService.create(dto)
	}

	/**
	 * 处理 DELETE /users/:id，硬删除用户及其资料。
	 *
	 * @remarks
	 * 路径参数在未配置转换管道时仍是字符串，number 类型标注不会自动转换。
	 * 未清理的其他关联外键可能导致删除失败，并使服务中的事务回滚。
	 *
	 * @param id - 路径中的用户主键。
	 * @returns 用户服务返回的删除成功响应。
	 * @throws NotFoundException - 对应用户不存在。
	 */
	@Delete('/:id')
	removeUser(@Param('id') id: number) {
		// Delete 是 RESTful 的 method 名
		// 用remove可以触发 typeorm Delete 钩子函数，而 delete 不会触发
		return this.userService.remove(id)
	}
}
