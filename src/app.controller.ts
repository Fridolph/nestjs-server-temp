import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post()
  postEmpty(@Body() params: Record<string, any>) {
    return {
      params: JSON.stringify(params),
      code: 0,
      msg: '请求成功'
    }
  }
}
