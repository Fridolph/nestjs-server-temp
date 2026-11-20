import { Menus } from '../../menus/menus.entity.ts'
import Roles from '../../roles/roles.entity.ts'
import User from '../../user/user.entity.ts'
import Logs from '../logs/logs.entity.ts'

export const getEntities = (path: string) => {
	// 当前路径 和 实体的对应关系为：
	// /users -> User
	// /logs -> Logs
	// /roles -> Roles
	// /menus -> Menus
	// /auth -> 'Auth'
	const map: Record<string, any> = {
		'/users': User,
		'/logs': Logs,
		'/roles': Roles,
		'/menus': Menus,
		'/auth': 'Auth',
	}

	for (let i = 0; i < Object.keys(map).length; i++) {
		const key = Object.keys(map)[i]
		if (path.startsWith(key)) {
			return map[key]
		}
	}
}
