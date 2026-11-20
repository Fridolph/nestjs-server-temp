import { AbilityBuilder, createMongoAbility } from '@casl/ability'
import { Injectable } from '@nestjs/common'
// import Logs from '../common/logs/logs.entity.ts'
// import { UserService } from '../user/user.service.ts'
import { getEntities } from '../common/utils/entity.ts'
import { MenusService } from '../menus/menus.service.ts'

@Injectable()
export class CaslAbilityService {
	constructor(private readonly menuService: MenusService) {}

	async forRoot(user: { userId: number; username: string; roleIds: number[] }) {
		console.log('🚀 CaslAbilityService ~ forRoot ~ user:\n', user)

		// 针对整个系统的 -> createUser XXX System
		const { can, cannot, build } = new AbilityBuilder(createMongoAbility)
		// can('manage', 'all')
		// 提几种思路：
		// 1、menu 名称、路径、acl -> Actions -> 名称、路径 -> 对应实体
		// path -> prefix -> 写死在项目代码里

		// 2、acl 单独数据表进行存储：
		// logController + Action  直接按 controller 进行对应

		// 3. log -> sys:log:read, admin:log:update ...
		// can('read', Logs)
		// cannot('update', Logs)
		const menus = await this.menuService.findWithRoleId(user.userId)
		console.log('🚀 CaslAbilityService ~ forRoot ~ menuList:\n', menus)

		menus.forEach(menu => {
			const actions = menu.acl.split(',')
			for (let i = 0; i < actions.length; i++) {
				const action = actions[i].trim()
				can(action, getEntities(menu.path as string))
			}
		})

		const ability = build({
			detectSubjectType: obj => obj.constructor,
		})

		return ability
	}
}
