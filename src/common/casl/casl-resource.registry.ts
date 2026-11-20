import { Injectable, InternalServerErrorException, type OnModuleInit } from '@nestjs/common'
import { DataSource } from 'typeorm'
import {
	CASL_RESOURCE_KEY,
	type CaslResourceOptions,
} from '../decorators/casl-resource.decorator.ts'
import type { EffectivePermission } from '../../permissions/permissions.dto.ts'
import { CaslAction } from '../constants/casl.ts'

type ResourceDefinition = CaslResourceOptions & { target: Function }

/** 启动时构建资源索引；每个请求只查 Map，不重复扫描文件或 Entity。 */
@Injectable()
export class CaslResourceRegistry implements OnModuleInit {
	private readonly resources = new Map<string, ResourceDefinition>()

	constructor(private readonly dataSource: DataSource) {}

	onModuleInit() {
		this.resources.clear()
		for (const metadata of this.dataSource.entityMetadatas) {
			if (metadata.isJunction || typeof metadata.target !== 'function') continue
			const options = Reflect.getOwnMetadata(CASL_RESOURCE_KEY, metadata.target) as
				CaslResourceOptions | undefined
			if (!options) continue
			if (!/^[a-z][a-z0-9._-]*$/.test(options.name) || options.name === 'all') {
				throw new Error(`无效的 CASL 资源标识：${options.name}`)
			}
			if (this.resources.has(options.name)) throw new Error(`重复的 CASL 资源：${options.name}`)
			if (options.actions.includes(CaslAction.Manage)) throw new Error('manage 只供超管使用')
			const columnNames = new Set(metadata.columns.map(column => column.propertyName))
			if (options.fields.some(field => !columnNames.has(field) || /[*.$]/.test(field))) {
				throw new Error(`CASL 字段声明与 Entity 不一致：${options.name}`)
			}
			this.resources.set(options.name, { ...options, target: metadata.target })
		}
	}

	/** 未知资源、保留动作、非法字段均按配置错误拒绝，不能退化成无限制授权。 */
	resolve(permission: EffectivePermission) {
		const definition = this.resources.get(permission.resource)
		if (
			!definition ||
			!definition.actions.includes(permission.action) ||
			(permission.fields !== null &&
				permission.fields.some(field => !definition.fields.includes(field)))
		) {
			throw new InternalServerErrorException('权限配置无效，请联系管理员')
		}
		return definition.target
	}
}
