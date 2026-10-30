export interface QueryUserDto {
	username?: string
	gender?: number | string
	role?: number | string
	profileId?: number | string
	page?: number | string
	size?: number | string
}

export interface CreateUserDto {
	username: string
	password: string
	phone?: string
	email?: string
}

// LEFT JOIN 未匹配到资料时，profile 字段为 null。
export interface UserWithProfileRow {
	id: number
	username: string
	profileId: number | null
	gender: number | null
	photo: string | null
	address: string | null
}
