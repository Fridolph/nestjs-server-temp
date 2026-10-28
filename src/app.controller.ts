import { Body, Controller, Get, Post } from '@nestjs/common'
import { AppService } from './app.service.js'
import { ConfigService } from '@nestjs/config'

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    const db = this.configService.get('USERNAME')
    console.log('test db -> \n', db)
    return this.appService.getHello()
  }

  @Post()
  postEmpty(@Body() params: Record<string, any>) {
    return {
      params: JSON.stringify(params),
      code: 0,
      msg: '请求成功',
    }
  }
}
