import { type AnyMongoAbility } from '@casl/ability'
import { ForbiddenException } from '@nestjs/common'
import { CaslAction } from '../constants/casl.ts'

/** 在任何写入之前检查全部变更字段；调用方仍需 Zod 输入白名单和可信数据范围校验。 */
export function assertUpdateFields(
	ability: AnyMongoAbility,
	target: Function,
	data: Record<string, unknown>,
	trustedRecord: object
) {
	// 当前项目以 Entity 类作为 subject，保留其原型以供 detectSubjectType 识别。
	const resource = Object.assign(Object.create(target.prototype), trustedRecord)
	Object.defineProperty(resource, 'constructor', { value: target })
	for (const field of Object.keys(data)) {
		if (data[field] !== undefined && !ability.can(CaslAction.Update, resource, field)) {
			throw new ForbiddenException(`无权修改字段：${field}`)
		}
	}
}
