import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import type { LoggerService } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { ConfigService } from '@nestjs/config'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { AllExceptionFilter } from './common/filters/all-exception.filter.ts'

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		// instrument: ObserveInstrument,
		bufferLogs: true,
	})
	const logger = app.get<LoggerService>(WINSTON_MODULE_NEST_PROVIDER)
	app.useLogger(logger)
	// 注：Nestjs 中 虽可定义多个 GlobalFilter 但只有第一个生效
	// app.useGlobalFilters(new AllExceptionFilter(logger, app.get(HttpAdapterHost)))

	const configService = app.get(ConfigService)
	const prefix = configService.get<string>('PREFIX') ?? 'api'
	const version = configService.get<string>('VERSION') ?? 'v1'
	app.setGlobalPrefix(`${prefix}/${version}`)

	app.enableCors({
		origin: ['http://localhost:3050', 'http://127.0.0.1:3050', '*'],
	})

	const port = Number(configService.get<string>('SERVER_PORT') ?? '3000')
	await app.listen(process.env.SERVER_PORT ?? port)
}
await bootstrap()
