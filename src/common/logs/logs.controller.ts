import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../guards/jwt.guard.ts'
import { AdminGuard } from '../guards/admin.guard.ts'
import { CaslGuard } from '../guards/casl.guard.ts'
import { Can, Cannot, CheckPolicies } from '../decorators/casl.decorator.ts'
import Logs from './logs.entity.ts'
import { CaslAction } from '../constants/casl.ts'

@Controller('logs')
@UseGuards(JwtGuard, CaslGuard)
@CheckPolicies(ability => ability.can(CaslAction.Read, Logs))
export class LogsController {
	constructor() {}

	@Get('test')
	@Can(CaslAction.Read, Logs)
	test() {
		return {
			code: 200,
			msg: '测试成功',
		}
	}

	@Get(':id')
	@Can(CaslAction.Read, Logs)
	getUserLogs(@Param('id', ParseIntPipe) id: number) {
		return {
			code: 200,
			msg: true,
		}
	}

	@Get('logsByGroup/:id')
	getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
		return {}
		// return this.userService.findLogsByGroup(id)
	}
}
