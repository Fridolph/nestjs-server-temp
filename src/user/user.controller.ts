import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { UserService } from './user.service.ts'
import User from './user.entity.ts'

@Controller('user')
export class UserController {
  constructor(
    // private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  @Get()
  getUsers() {
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
