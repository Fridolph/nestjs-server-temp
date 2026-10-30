import type { LoggerService } from '@nestjs/common'
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { UserService } from './user.service.ts'
import User from './user.entity.ts'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
  ) {
    // this.logger.log('测试一下')
  }

  @Get()
  getUsers() {
    const user = {
      isAdmin: false,
    }
    this.logger.log('log1')
    this.logger.warn('warn2')
    this.logger.error('error3')

    if (!user.isAdmin) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN)
    }

    return this.userService.findAll()
  }

  @Post()
  addUser(@Body() dto: User) {
    return this.userService.create(dto)
  }

  @Get('/profile/:id')
  getUserProfile(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findProfile(id)
  }

  @Get('/logs/:id')
  getUserLogs(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findLogs(id)
  }

  @Get('/logsByGroup/:id')
  getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findLogsByGroup(id)
  }
}
