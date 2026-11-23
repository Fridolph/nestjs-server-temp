import type { AnyMongoAbility, SubjectType } from '@casl/ability'
import type { CustomDecorator } from '@nestjs/common'
import { CaslAction } from '../constants/casl.ts'

export enum CHECK_POLICIES_KEY {
	Handler = 'CHECK_POLICIES_HANDLER',
	Can = 'CHECK_POLICIES_CAN',
	Cannot = 'CHECK_POLICIES_CANNOT',
}

export interface PolicyRequirement {
	type: 'can' | 'cannot'
	action: CaslAction
	subject: SubjectType
	field?: string
}

export type PolicyHandlerCallback = ((ability: AnyMongoAbility) => boolean) & {
	requirement?: PolicyRequirement
}
export type CaslHandlerType = PolicyHandlerCallback[]

function createPolicyHandler(
	check: (ability: AnyMongoAbility) => boolean,
	requirement: PolicyRequirement
): PolicyHandlerCallback {
	const handler = check as PolicyHandlerCallback
	handler.requirement = requirement
	return handler
}

/** 返回可公开的策略摘要；不暴露 CASL Ability 的内部规则对象。 */
export function describePolicy(handler: PolicyHandlerCallback) {
	const requirement = handler.requirement
	if (!requirement) return '自定义策略'
	const subject =
		typeof requirement.subject === 'string'
			? requirement.subject
			: requirement.subject.name || '未知资源'
	const field = requirement.field ? `.${requirement.field}` : ''
	const action = requirement.type === 'cannot' ? `禁止 ${requirement.action}` : requirement.action
	return `${action} ${subject}${field}`
}

/** 同一目标上重复声明也追加保存；类与方法之间由 Guard 合并为 AND。 */
function appendPolicies(
	key: CHECK_POLICIES_KEY,
	handlers: PolicyHandlerCallback[]
): CustomDecorator {
	const decorator: CustomDecorator = (
		target: object,
		_propertyKey?: string | symbol,
		descriptor?: PropertyDescriptor
	) => {
		const destination = descriptor?.value ?? target
		const existing = Reflect.getOwnMetadata(key, destination) as PolicyHandlerCallback[] | undefined
		Reflect.defineMetadata(key, [...(existing ?? []), ...handlers], destination)
	}
	decorator.KEY = key
	return decorator
}

/** 声明入口策略；回调在 Guard 中执行，不在装饰器定义时执行。 */
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
	appendPolicies(CHECK_POLICIES_KEY.Handler, handlers)

/** 第三个参数为单个字段名；数据条件需在 Ability 中定义并检查可信对象。 */
export const Can = (action: CaslAction, subject: SubjectType, field?: string) =>
	appendPolicies(CHECK_POLICIES_KEY.Can, [
		createPolicyHandler(ability => ability.can(action, subject, field), {
			type: 'can',
			action,
			subject,
			field,
		}),
	])

/** 检查“不具备权限”，并非定义禁止规则；操作入口通常应使用 Can。 */
export const Cannot = (action: CaslAction, subject: SubjectType, field?: string) =>
	appendPolicies(CHECK_POLICIES_KEY.Cannot, [
		createPolicyHandler(ability => ability.cannot(action, subject, field), {
			type: 'cannot',
			action,
			subject,
			field,
		}),
	])
