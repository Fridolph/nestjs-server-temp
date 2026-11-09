import { Injectable } from '@nestjs/common'
import type { UpdateProfileDto } from '../dto/update-profile.dto.ts'
import ProfileRpst from './profile.repository.ts'

/** 编排资料查询和更新，向 Controller 返回统一的业务响应。 */
@Injectable()
export class ProfileService {
	constructor(private readonly profileRpst: ProfileRpst) {}

	/**
	 * 查询指定启用用户的基本信息与资料。
	 *
	 * @param userId - 用户表主键，不是独立的资料编号。
	 * @returns 包含业务状态码和单个资料对象的响应。
	 * @throws NotFoundException - 没有匹配到启用用户的资料。
	 */
	async getUserProfile(userId: number) {
		const profile = await this.profileRpst.getProfileById(userId)
		return {
			code: 200,
			data: profile,
		}
	}

	/**
	 * 只更新请求提供的资料字段，不存在时返回 404，重复提交原值仍成功。
	 *
	 * @param id - 待更新资料所属的用户主键。
	 * @param updateProfileDto - 已经校验和转换后的可选更新字段。
	 * @returns 更新成功响应。
	 * @throws BadRequestException - 没有提供可更新字段。
	 * @throws NotFoundException - 用户资料不存在。
	 * @throws QueryFailedError - 昵称违反唯一约束等数据库写入错误。
	 */
	async updateProfile(id: number, updateProfileDto: UpdateProfileDto) {
		await this.profileRpst.updateProfile(id, updateProfileDto)

		return {
			code: 200,
			data: true,
			msg: `更新用户 [${id}] 成功`,
		}
	}
}
