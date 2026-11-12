import type { DataSourceOptions } from 'typeorm'
import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { ConfigEnum } from './src/common/config/config.enum.ts'

// 通过环境变量读取不同的 .env 文件
function getEnv(env: string): Record<string, unknown> {
	if (existsSync(env)) {
		return dotenv.parse(readFileSync(env))
	}
	return {}
}

// 通过 dotEnv 来解析不同的配置文件
function buildConnectionOptions() {
	const defaultConfig = getEnv('.env')
	const envConfig = getEnv(`.env.${process.env.NODE_ENV || 'development'}`)
	const config = { ...defaultConfig, ...envConfig }
	// ts-node 加载源码时扫描 .ts，Nest 编译后运行时扫描 dist/src 下的 .js。
	const entityExtension = import.meta.filename.endsWith('.ts') ? 'ts' : 'js'
	const entitiesDir = [join(import.meta.dirname, 'src', `**/*.entity.${entityExtension}`)]

	return {
		type: config[ConfigEnum.TYPE],
		host: config[ConfigEnum.HOST],
		port: config[ConfigEnum.PORT],
		username: config[ConfigEnum.USERNAME],
		password: config[ConfigEnum.PASSWORD],
		database: config[ConfigEnum.DATABASE],
		entities: entitiesDir,
		// 同步本地的schema与数据库 -> 初始化时使用
		synchronize: true,
		logging: process.env.NODE_ENV === 'development',
	} as TypeOrmModuleOptions
}

export const connectionParams = buildConnectionOptions()

export default new DataSource({
	...connectionParams,
	migrations: ['src/migrations/**'],
	subscribers: [],
} as DataSourceOptions)
