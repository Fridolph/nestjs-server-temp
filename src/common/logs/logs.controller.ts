import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common'
import { JwtGuard } from '../guards/jwt.guard.ts'
import { AdminGuard } from '../guards/admin.guard.ts'

@Controller('logs')
@UseGuards(JwtGuard, AdminGuard)
export class LogsController {
	@Get('/:id')
	getUserLogs(@Param('id', ParseIntPipe) id: number) {
		return id
		// return this.userService.findLogs(id)
	}

	@Get('/logsByGroup/:id')
	getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
		return {}
		// return this.userService.findLogsByGroup(id)
	}
}
