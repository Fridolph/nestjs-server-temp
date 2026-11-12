import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	ServiceUnavailableException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, type Repository } from 'typeorm'
import User from '../user.entity.ts'
import UserProfile from '../profile/profile.entity.ts'
import Roles from '../../roles/roles.entity.ts'
import type { CreateUserDto } from '../dto/create-user.dto.ts'

/** 封装创建用户、角色关联及默认资料所需的同一数据库事务。 */
@Injectable()
export default class UserCreateRpst {
	constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

	/**
	 * 原子地创建用户、关联已有角色并初始化资料。
	 *
	 * @remarks
	 * DTO 应已通过 Zod 校验；所有读写均使用事务回调提供的 manager。
	 * users.save 根据 User.roles 的多对多映射写入 users_roles，不是创建新角色。
	 * 昵称未提供时使用用户名；用户名和昵称的并发唯一性依赖数据库唯一约束。
	 * 按稳定的 role.code 拒绝 super_admin，不依赖数据库中角色 ID 的排列。
	 * 密码按传入值保存；正式认证功能仍需在写入前完成密码哈希。
	 * 任一步骤抛错都会回滚，包括用户已保存后资料插入失败的情况。
	 *
	 * @param dto - 已校验的用户信息、非空且不重复的角色 ID 和可选资料。
	 * @returns 事务提交后的用户实体；包含内部字段，不应直接作为接口响应。
	 * @throws BadRequestException - 请求角色数量与查到的角色数量不一致。
	 * @throws ConflictException - 提前查询发现用户名已存在。
	 * @throws ForbiddenException - 所选角色包含超管。
	 */
	async createUser(dto: CreateUserDto) {
		return this.persistUser(dto, dto.roleIds)
	}

	/**
	 * 自助注册只分配 code=user 的角色，不读取客户端角色字段。
	 * 角色查询和用户、资料写入使用同一事务；默认角色缺失则中止，不创建无角色用户。
	 * @throws ServiceUnavailableException - 普通用户角色尚未配置。
	 */
	async createRegisteredUser(dto: Omit<CreateUserDto, 'roleIds'>) {
		return this.persistUser(dto)
	}

	/** 复用创建事务；管理员创建传角色 ID，注册分支始终按稳定 code 查普通用户。 */
	private async persistUser(dto: Omit<CreateUserDto, 'roleIds'>, roleIds?: number[]) {
		const newUser = await this.userRepository.manager.transaction(async manager => {
			const users = manager.getRepository(User)
			const profiles = manager.getRepository(UserProfile)
			const roles = await manager.getRepository(Roles).findBy(
				roleIds === undefined ? { code: 'user' } : { id: In(roleIds) }
			)
			if (roleIds === undefined && roles.length !== 1) {
				throw new ServiceUnavailableException('注册服务暂不可用：普通用户角色未配置')
			}
			if (roleIds !== undefined && roles.length !== roleIds.length) {
				throw new BadRequestException('所选角色不存在')
			}
			if (roles.some(role => role.code === 'super_admin')) {
				throw new ForbiddenException('创建用户时不能分配超管角色')
			}
			const isExist = await users.findOne({
				where: { username: dto.username },
			})
			if (isExist) throw new ConflictException('用户名已被使用')

			const user = users.create({
				username: dto.username,
				password: dto.password,
				roles,
			})
			await users.save(user)
			await profiles.insert({
				userId: user.id,
				nickname: dto.nickname ?? user.username,
				gender: dto.gender ?? null,
				photo: dto.photo ?? null,
				address: dto.address ?? null,
			})
			return user
		})

		return newUser
	}
}
