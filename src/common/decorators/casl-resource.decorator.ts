import 'reflect-metadata'
import type { CaslAction } from '../constants/casl.ts'

export const CASL_RESOURCE_KEY = Symbol('CASL_RESOURCE')

export interface CaslResourceOptions {
	name: string
	actions: readonly CaslAction[]
	/** 可被单独授权的字段；不包含密码、关系对象等内部数据。 */
	fields: readonly string[]
}

/** 显式声明授权资源；注册表从 TypeORM 已加载的 Entity 自动收集，无需集中导入。 */
export const CaslResource =
	(options: CaslResourceOptions): ClassDecorator =>
	target => {
		Reflect.defineMetadata(CASL_RESOURCE_KEY, options, target)
	}
