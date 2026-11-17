import { ConfigService } from '@nestjs/config'
import { Global, Module } from '@nestjs/common'
import winston from 'winston'
import { utilities, WinstonModule } from 'nest-winston'
import type { WinstonModuleOptions } from 'nest-winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { LogEnum } from '../config/config.enum.ts'

@Global()
@Module({
	imports: [
		WinstonModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService): WinstonModuleOptions => {
				// 环境变量通常是字符串，不能直接用它判断布尔值。
				const logOn = configService.get<string | boolean>(LogEnum.LOG_ON) ?? true
				const enabled = logOn === true || logOn === 'true'

				return {
					silent: !enabled,
					level: configService.get<string>(LogEnum.LOG_LEVEL) ?? 'info',
					transports: [
						new winston.transports.Console({
							format: winston.format.combine(
								winston.format.timestamp(),
								utilities.format.nestLike()
							),
						}),
						...(enabled
							? [
									createDailyRotateTransport('info', 'app'),
									createDailyRotateTransport('warn', 'warn'),
									createDailyRotateTransport('error', 'error'),
								]
							: []),
					],
				}
			},
		}),
	],
	exports: [],
})
export class LogsModule {}

function createDailyRotateTransport(level: string, fileName: string) {
	return new DailyRotateFile({
		level,
		dirname: 'logs',
		filename: `${fileName}-%DATE%.log`,
		datePattern: 'YYYY-MM-DD',
		zippedArchive: true,
		maxSize: '10M',
		maxFiles: '14d',
		format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
	})
}
