import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import type { ResultSetHeader } from 'mysql2'
import UserProfile from '../profile/profile.entity.ts'
import type { UpdateProfileDto } from '../dto/update-profile.dto.ts'

/** 原生 SQL 查询返回的扁平用户资料，不包含密码字段。 */
type ProfileRow = {
	userId: number
	username: string
	phone: string | null
	email: string | null
	nickname: string | null
	gender: number | null
	photo: string | null
	address: string | null
}

/** 封装资料查询和部分更新，保留 TypeORM 与原生 SQL 两种学习实现。 */
@Injectable()
export default class ProfileRpst {
	constructor(
		@InjectRepository(UserProfile) private readonly profileRepst: Repository<UserProfile>
	) {}

	/**
	 * 使用参数化 INNER JOIN 查询启用用户及其资料。
	 *
	 * @param userId - 用户主键，也是 profile 表的共享主键。
	 * @returns 扁平资料对象，包含用户名、联系方式及资料字段。
	 * @throws NotFoundException - 用户不存在、已停用，或尚未创建资料。
	 */
	async getProfileWithSql(userId: number) {
		const dataSql = `
      SELECT
        p.userId,
        u.username,
        u.phone,
        u.email,
        p.nickname,
        p.gender,
        p.photo,
        p.address
      FROM profile AS p
        INNER JOIN \`user\` AS u ON p.userId = u.id
      WHERE u.id = ? AND u.isActive = 1
    `
		const profiles = await this.profileRepst.query<ProfileRow[]>(dataSql, [userId])

		if (profiles.length === 0) throw new NotFoundException('没有查询到用户信息')

		return profiles[0]
	}

	/**
	 * 使用 TypeORM 关联查询获取启用用户的资料，并将结果转为扁平对象。
	 *
	 * @remarks
	 * 显式选择 user 字段，避免把密码等内部字段带入返回值。
	 * 返回字段与原生 SQL 版本对应；实体中的可空可选属性在 TS 类型上还包含 undefined。
	 *
	 * @param userId - 用户主键，也是 profile 表的共享主键。
	 * @returns 用户基本信息与资料组成的单个对象。
	 * @throws NotFoundException - 用户不存在、已停用，或尚未创建资料。
	 */
	async getProfileById(userId: number) {
		const profile = await this.profileRepst.findOne({
			where: {
				userId,
				user: {
					isActive: true,
				},
			},
			relations: {
				user: true,
			},
			select: {
				userId: true,
				nickname: true,
				gender: true,
				photo: true,
				address: true,
				user: {
					username: true,
					phone: true,
					email: true,
				},
			},
		})

		if (!profile || !profile.user) throw new NotFoundException('没有查询到用户信息')

		return {
			userId: profile.userId,
			username: profile.user.username,
			nickname: profile.nickname,
			phone: profile.user.phone,
			email: profile.user.email,
			gender: profile.gender,
			photo: profile.photo,
			address: profile.address,
		}
	}

	/**
	 * 使用 TypeORM 只更新请求中明确提供的资料字段。
	 *
	 * @remarks
	 * undefined 表示不修改；null 表示清空允许为空的字段，gender 为 0 时也会保留。
	 * 调用方应先完成 Schema 校验，数据库唯一约束负责拒绝重复昵称。
	 * 单条 UPDATE 自身是原子的，此处不需要额外开启多语句事务。
	 * 影响行数为 0 时复查资料是否存在，兼容驱动对“重复提交原值”的不同计数方式。
	 *
	 * @param userId - 待更新资料所属用户的主键。
	 * @param updateProfileDto - 已校验和归一化的可选更新字段。
	 * @returns 数据库报告的影响行数；原值重复提交允许返回 0。
	 * @throws BadRequestException - 没有提供可更新字段。
	 * @throws NotFoundException - 资料不存在。
	 */
	async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
		const { nickname, gender, photo, address } = updateProfileDto

		// 只挑选允许更新、且实际提供了的字段
		const updateData = {
			...(nickname !== undefined ? { nickname } : {}),
			...(gender !== undefined ? { gender } : {}),
			...(photo !== undefined ? { photo } : {}),
			...(address !== undefined ? { address } : {}),
		}

		if (Object.keys(updateData).length === 0) {
			throw new BadRequestException('没有提供可更新的字段')
		}

		// 直接更新，数据库负责检查昵称唯一索引
		const result = await this.profileRepst.update({ userId }, updateData)
		await this.ensureProfileMatched(userId, result.affected ?? 0)
		return result.affected ?? 0
	}

	/**
	 * 使用字段白名单构造参数化 UPDATE 的原生 SQL 学习版本。
	 *
	 * @remarks
	 * 列名只来自程序内白名单，字段值与用户 ID 均使用占位符绑定。
	 * 与 TypeORM 版本一样跳过 undefined，保留 null 和 0，并区分资料不存在与原值重复提交。
	 *
	 * @param id - 待更新资料所属用户的主键。
	 * @param updateProfileDto - 已校验和归一化的可选更新字段。
	 * @returns 数据库报告的影响行数。
	 * @throws BadRequestException - 没有提供可更新字段。
	 * @throws NotFoundException - 资料不存在。
	 */
	async updateProfileWithSql(id: number, updateProfileDto: UpdateProfileDto) {
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

		const updateSql = `
		  UPDATE profile
		  SET ${assignments.join(', ')}
		  WHERE userId = ?
		`

		const result = await this.profileRepst.query<ResultSetHeader>(updateSql, [...parameters, id])
		await this.ensureProfileMatched(id, result.affectedRows)
		return result.affectedRows
	}

	/** 零影响行数也可能是提交了原值，仅在复查仍不存在时返回 404。 */
	private async ensureProfileMatched(userId: number, affected: number) {
		if (affected > 0) return
		if (!(await this.profileRepst.existsBy({ userId }))) {
			throw new NotFoundException('用户资料不存在')
		}
	}
}
