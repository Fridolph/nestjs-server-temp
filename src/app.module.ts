import { Module } from '@nestjs/common'
import { createObserveModule } from '@nestjs/observe'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import Joi from 'joi'
import { AppController } from './app.controller.ts'
import { AppService } from './app.service.ts'
import { UserModule } from './user/user.module.ts'
import { LogsController } from './common/logs/logs.controller.ts'
import { RolesController } from './roles/roles.controller.ts'
import { LogsModule } from './common/logs/logs.module.ts'
import { connectionParams } from '../ormconfig.ts'
import { AuthModule } from './auth/auth.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule()

const nodeEnv = process.env.NODE_ENV ?? 'development'
const envFilePath = [`.env.${nodeEnv}`, '.env']

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    // ObserveModule.forRoot({
    //   appKey: process.env.OBSERVE_APP_KEY,
    //   appSecret: process.env.OBSERVE_APP_SECRET,
    //   serviceId: 'nestjs-demo',
    // }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema: Joi.object({
        PREFIX: Joi.string().default('api'),
        VERSION: Joi.string().default('v1'),
        NODE_ENV: Joi.string().valid('development', 'production').default('development'),
        DB_HOST: Joi.string(),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
      }),
    }),

    TypeOrmModule.forRoot(connectionParams),

    LogsModule,

    UserModule,

    AuthModule,

  ],
  controllers: [AppController, LogsController, RolesController],
  providers: [AppService],
})
export class AppModule {}
