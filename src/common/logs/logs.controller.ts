import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../guards/jwt.guard.ts'
import { CaslGuard } from '../guards/casl.guard.ts'
import { Can } from '../decorators/casl.decorator.ts'
import Logs from './logs.entity.ts'
import { CaslAction } from '../constants/casl.ts'

@Controller('logs')
@UseGuards(JwtGuard, CaslGuard)
export class LogsController {
	/** 查询指定用户日志的学习入口，先执行日志读取授权。 */
	@Get(':id')
	@Can(CaslAction.Read, Logs)
	getUserLogs(@Param('id', ParseIntPipe) id: number) {
		return {
			code: 200,
			msg: true,
		}
	}

	/** 查询分组日志的学习入口。 */
	@Get('logsByGroup/:id')
	@Can(CaslAction.Read, Logs)
	getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
		return {}
		// return this.userService.findLogsByGroup(id)
	}
}
