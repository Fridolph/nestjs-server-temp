import { join } from 'node:path'
import { DataSource } from 'typeorm'
import type { DataSourceOptions } from 'typeorm'
import { connectionParams } from '../ormconfig.ts'

const extension = import.meta.filename.endsWith('.ts') ? 'ts' : 'js'

// CLI 负责连接与关闭数据库；导入入口时只创建实例，不查询数据或自动同步表结构。
export default new DataSource({
	...connectionParams,
	synchronize: false,
	migrationsRun: false,
	migrations: [join(import.meta.dirname, 'migrations', `*.${extension}`)],
	subscribers: [],
} as DataSourceOptions)
