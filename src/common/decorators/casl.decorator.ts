import { InferSubjects, type AnyMongoAbility } from '@casl/ability'
import { SetMetadata } from '@nestjs/common'
import { CaslAction } from '../constants/casl.ts'

export enum CHECK_POLICIES_KEY {
	Handler = 'CHECK_POLICIES_HANDLER',
	Can = 'CHECK_POLICIES_CAN',
	Cannot = 'CHECK_POLICIES_CANNOT',
}

// Guards -> routes meta -> @CheckPolicies @Can @Cannot

export type PolicyHandlerCallback = (ability: AnyMongoAbility) => boolean

export type CaslHandlerType = PolicyHandlerCallback | PolicyHandlerCallback[]

// @CheckPolicies -> handler -> ability => boolean
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
	SetMetadata(CHECK_POLICIES_KEY.Handler, handlers)

// @Can -> Action, Subject, Conditions
export const Can = (action: CaslAction, subject: InferSubjects<any>, conditions?: any) =>
	SetMetadata(CHECK_POLICIES_KEY.Can, (ability: AnyMongoAbility) =>
		ability.can(action, subject, conditions)
	)

// @Cannot -> Actions, Subject, Conditions
export const Cannot = (action: CaslAction, subject: InferSubjects<any>, conditions?: any) =>
	SetMetadata(CHECK_POLICIES_KEY.Cannot, (ability: AnyMongoAbility) =>
		ability.cannot(action, subject, conditions)
	)
