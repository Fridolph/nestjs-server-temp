import { Module } from '@nestjs/common'
import { createObserveModule } from '@nestjs/observe'
import { AppController } from './app.controller.ts'
import { AppService } from './app.service.ts'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm'
import { DBConfigEnum } from './config/db.enum.ts'
import { UserModule } from './user/user.module.ts'
import { ProfileController } from './user/profile/profile.controller.ts'
import { LogsController } from './logs/logs.controller.ts'
import { RolesController } from './roles/roles.controller.ts'
import Joi from 'joi'
import User from './user/user.entity.ts'
import Profile from './user/profile/profile.entity.ts'
import Logs from './logs/logs.entity.ts'
import Roles from './roles//roles.entity.ts'

export const { ObserveModule, ObserveInstrument } = createObserveModule()

const nodeEnv = process.env.NODE_ENV ?? 'development'
const envFilePath = [`.env.${nodeEnv}`, '.env']

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    // ObserveModule.forRoot({
    //   appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
    //   appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
    //   serviceId: 'nestjs-demo',
    // }),

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'mysql',
        host: configService.getOrThrow<string>(DBConfigEnum.HOST),
        port: Number(configService.getOrThrow<string>(DBConfigEnum.PORT)),
        username: configService.getOrThrow<string>(DBConfigEnum.USERNAME),
        password: configService.getOrThrow<string>(DBConfigEnum.PASSWORD),
        database: configService.getOrThrow<string>(DBConfigEnum.DATABASE),
        autoLoadEntities: true,
        synchronize: true,
        logging: ['error'],
        entities: [User, Roles, Profile, Logs],
      }),
    }),

    UserModule,
  ],
  controllers: [
    AppController,
    ProfileController,
    LogsController,
    RolesController,
  ],
  providers: [AppService],
})
export class AppModule {}
