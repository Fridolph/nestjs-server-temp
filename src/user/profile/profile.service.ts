import {
	BadRequestException,
	ConflictException,
	HttpException,
	HttpStatus,
	Injectable,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Profile from './profile.entity.ts'
import type { UpdateProfileDto } from './dto/update-profile.dto.ts'

@Injectable()
export class ProfileService {
	/**
	 * 初始化用户资料服务。
	 *
	 * @param profileRepository - 用户资料实体仓库。
	 */
	constructor(@InjectRepository(Profile) private readonly profileRepository: Repository<Profile>) {}

	/**
	 * 通过原生 SQL 查询指定启用用户的用户名和资料。
	 *
	 * @remarks
	 * 使用 INNER JOIN，仅返回同时存在用户、资料且用户启用的记录。
	 * 查询结果保留为数组，不存在或用户停用时返回空数组。
	 * 当前 SQL 直接插入 id，调用方必须保证其为经过校验的整数。
	 *
	 * @param id - 用户表主键，不是独立的资料编号。
	 * @returns 包含业务状态码和资料查询结果数组的响应。
	 * @throws 数据库查询失败时向调用方传播异常。
	 */
	async getProfile(id: number) {
		console.log('🚀 ~ :6 ~ ProfileService ~ getProfile ~ id:', id)
		const dataSql = `
SELECT u.username, p.nickname, p.gender, p.photo, p.address, p.userId
FROM profile AS p
  INNER JOIN \`user\` AS u ON p.userId = u.id
WHERE u.id = ${id}
	AND u.isActive = 1;
`
		const data = await this.profileRepository.query(dataSql)

		return {
			code: 200,
			data: data?.[0],
		}
	}

	/**
	 * 仅更新提供的资料字段，并在修改昵称时检查其他用户是否已使用该昵称。
	 *
	 * @remarks
	 * 调用方应先通过 Schema 校验并归一化请求；未提供昵称时不执行查重。
	 * 查重排除当前用户，允许重复提交自己的原昵称。
	 * 提前查询不能保证并发唯一性，仍需数据库唯一索引兜底。
	 *
	 * @param id - 待更新资料所属的用户主键。
	 * @param updateProfileDto - 已经校验和转换后的可选更新字段。
	 * @returns 更新成功响应。
	 * @throws BadRequestException - 没有提供可更新字段。
	 * @throws ConflictException - 昵称已被其他用户使用。
	 */
	async updateProfile(id: number, updateProfileDto: UpdateProfileDto) {
		const allowedFields = ['nickname', 'gender', 'photo', 'address'] as const
		const assignments: string[] = []
		const parameters: (string | number | null)[] = []

		for (const field of allowedFields) {
			const value = updateProfileDto[field]
			if (value === undefined) continue
			assignments.push('`' + field + '` = ?')
			parameters.push(value)
		}

		if (assignments.length === 0) throw new BadRequestException('没有提供可更新的字段')

		if (updateProfileDto.nickname !== undefined) {
			const querySql = `
        SELECT userId
        FROM profile
        WHERE nickname = ? AND userId <> ?
        LIMIT 1
      `
			const existing = await this.profileRepository.query<{ userId: number }[]>(querySql, [
				updateProfileDto.nickname,
				id,
			])
			if (existing.length > 0) throw new ConflictException('用户昵称已存在')
		}

		const updateSql = `
		  UPDATE profile
		  SET ${assignments.join(', ')}
		  WHERE userId = ?
		`

		await this.profileRepository.query(updateSql, [...parameters, id])

		return {
			code: 200,
			data: true,
			msg: `更新用户 [${id}] 成功`,
		}
	}
}
