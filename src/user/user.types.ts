import type { UpdateProfileDto } from './dto/update-profile.dto.ts'
import type { CreateUserDto } from './dto/create-user.dto.ts'

export type { CreateUserDto, UpdateProfileDto }

/** 仅供内部认证读取；不得直接返回接口或写入 JWT、日志。 */
export interface UserAuthRow {
	id: number
	username: string
	password: string | null
	isActive: number | boolean
}

/** 用户列表的 HTTP 查询参数。 */
export interface QueryUserDto {
	id?: number | string
	username?: string
	gender?: number | string
	role?: number | string
	profileId?: number | string
	page?: number | string
	size?: number | string
}

/** 已归一化的仓库筛选条件；省略分页时使用第一页、每页 10 条。 */
export interface UserListCriteria {
	id?: number
	username?: string
	gender?: number
	role?: number
	profileId?: number
	page?: number
	size?: number
	offset?: number
}

export interface UpdateUserDto {
	phone?: string | null
	email?: string | null
	profile?: UpdateProfileDto
}

/** 用户列表 SQL 的单行结果；LEFT JOIN 未匹配到资料时，资料字段为 null。 */
export interface UserRow {
	userId: number
	username: string
	nickname: string | null
	profileId: number | null
	gender: number | null
	photo: string | null
	address: string | null
}

/** 用户角色关联 SQL 的单行结果；不包含用户名或资料字段。 */
export interface UserRoleRow {
	userId: number
	roleId: number
	roleCode: string
	roleName: string
}
