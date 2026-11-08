import type { UpdateProfileDto } from './dto/update-profile.dto.ts'
import type { CreateUserDto } from './dto/create-user.dto.ts'

export type { CreateUserDto, UpdateProfileDto }

export interface QueryUserDto {
	username?: string
	gender?: number | string
	role?: number | string
	profileId?: number | string
	page?: number | string
	size?: number | string
}

export interface UpdateUserDto {
	phone?: string | null
	email?: string | null
	profile?: UpdateProfileDto
}

// LEFT JOIN 未匹配到资料时，profile 字段为 null。
export interface UserWithProfileRow {
	id: number
	username: string
	nickname: string
	profileId: number | null
	gender: number | null
	photo: string | null
	address: string | null
}
