import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import Roles from './roles.entity.ts'
import type { CreateRoleDto, UpdateRoleDto } from './roles.dto.ts'

type RoleRow = { roleId: number; roleName: string; description: string; roleCode: string }

/**
 * 角色持久化操作，不组装 HTTP 响应。
 *
 * @remarks
 * 查询使用参数化原生 SQL；TypeORM 写入时使用实体属性 roleName / roleCode。
 * roleCode 是授权规则依赖的稳定标识，更新路径永远不允许修改它。
 */
@Injectable()
export class RolesRpst {
	constructor(@InjectRepository(Roles) private readonly repository: Repository<Roles>) {}

	/**
	 * 查询全部角色，并映射成接口使用的字段名。
	 * @remarks SQL 使用数据库列名 name / code，投影成 roleName / roleCode，不加载用户关联。
	 * @returns 按角色主键升序排列的角色列表。
	 */
	async findAllRoles(): Promise<RoleRow[]> {
		return this.repository.query<RoleRow[]>(
			`SELECT id AS roleId, description, code AS roleCode, name AS roleName FROM roles ORDER BY id`
		)
	}

	/**
	 * 创建角色并返回数据库最终保存的记录。
	 *
	 * @remarks
	 * create 只生成实体对象，save 才执行 INSERT。编码唯一性由数据库约束保证；
	 * 重复键错误转为 409，其他数据库错误原样向上抛。
	 * super_admin 是系统保留编码，不能通过通用接口创建。
	 *
	 * @param dto - 已由 Controller 的 Zod Pipe 校验的创建载荷。
	 * @returns 新角色的接口投影数据。
	 * @throws ConflictException - 角色编码已存在。
	 * @throws ForbiddenException - 使用系统保留编码。
	 */
	async createRole(dto: CreateRoleDto): Promise<RoleRow> {
		if (dto.roleCode === 'super_admin') throw new ForbiddenException('超管角色不能通过接口创建')
		try {
			const saved = await this.repository.save(
				this.repository.create({
					roleName: dto.roleName,
					description: dto.description,
					roleCode: dto.roleCode,
				})
			)
			return await this.findRoleById(saved.id)
		} catch (error) {
			if (this.isDuplicateKey(error)) throw new ConflictException('角色编码已存在')
			throw error
		}
	}

	/**
	 * 更新角色的可变资料。
	 *
	 * @remarks
	 * 先读取目标，以区分“角色不存在”和“重复提交原值”。
	 * update 的 affected 为 0 时再次确认目标是否仍存在，避免把原值重交误报为 404。
	 * 更新对象只包含实体属性 roleName 和 description，不会修改授权编码。
	 *
	 * @param roleId - 目标角色主键。
	 * @param dto - 名称和描述的部分更新数据。
	 * @throws NotFoundException - 角色不存在。
	 * @throws ForbiddenException - super_admin 角色只读。
	 */
	async updateRoleById(roleId: number, dto: UpdateRoleDto): Promise<void> {
		const role = await this.repository.findOneBy({ id: roleId })
		if (!role) throw new NotFoundException('角色不存在')
		if (role.roleCode === 'super_admin') throw new ForbiddenException('超管角色不能编辑')
		const result = await this.repository.update(roleId, {
			...(dto.roleName === undefined ? {} : { roleName: dto.roleName }),
			...(dto.description === undefined ? {} : { description: dto.description }),
		})
		if (!result.affected && !(await this.repository.existsBy({ id: roleId })))
			throw new NotFoundException('角色不存在')
	}

	/**
	 * 删除角色及其关联保护。
	 *
	 * @remarks
	 * 查询、校验和删除使用同一个事务 manager。
	 * 系统保留角色不可删除；角色仍有关联用户时拒绝删除，避免破坏用户授权关系。
	 *
	 * @param roleId - 待删除角色主键。
	 * @throws NotFoundException - 角色不存在。
	 * @throws ForbiddenException - 目标是 super_admin。
	 * @throws ConflictException - 角色仍被用户关联。
	 */
	async deleteRoleById(roleId: number): Promise<void> {
		await this.repository.manager.transaction(async manager => {
			const role = await manager
				.getRepository(Roles)
				.findOne({ where: { id: roleId }, relations: { users: true } })
			if (!role) throw new NotFoundException('角色不存在')
			if (role.roleCode === 'super_admin') throw new ForbiddenException('超管角色不能删除')
			if (role.users.length > 0) throw new ConflictException('该角色仍被用户使用，请先调整用户角色')
			await manager.getRepository(Roles).remove(role)
		})
	}

	/**
	 * 按主键查询单个角色的接口投影。
	 * @param roleId - 角色主键。
	 * @returns 角色的展示数据。
	 * @throws NotFoundException - 查询不到目标角色。
	 */
	async findRoleById(roleId: number): Promise<RoleRow> {
		const row = await this.findRoleByIdByRawSqlLearning(roleId)
		if (!row) throw new NotFoundException('角色不存在')
		return row
	}

	/**
	 * 识别 MySQL 唯一键冲突。
	 * @remarks 错误码可能位于驱动异常本身，也可能位于 TypeORM 包装的 driverError 中。
	 * @param error - 数据库抛出的未知异常。
	 * @returns 仅当错误码为 ER_DUP_ENTRY 时返回 true。
	 */
	private isDuplicateKey(error: unknown): boolean {
		if (typeof error !== 'object' || error === null) return false
		const candidate = error as { code?: unknown; driverError?: { code?: unknown } }
		return candidate.code === 'ER_DUP_ENTRY' || candidate.driverError?.code === 'ER_DUP_ENTRY'
	}

	/**
	 * 原生 SQL 的列表查询对照版，当前业务调用链不使用。
	 *
	 * @remarks
	 * 与 findAllRoles 返回相同的字段和排序。此查询没有动态条件，
	 * 因此参数数组为空；保留 query(sql, params) 形态便于与下面的按 ID 查询对照。
	 *
	 * @returns 按角色主键升序排列的角色列表。
	 */
	async findAllRolesByRawSqlLearning(): Promise<RoleRow[]> {
		const sql = `
      SELECT
        id AS roleId,
        name AS roleName,
        description,
        code AS roleCode
      FROM roles
      ORDER BY id ASC
    `
		return this.repository.query<RoleRow[]>(sql, [])
	}

	/**
	 * 原生 SQL 的单角色查询，供 findRoleById 复用。
	 *
	 * @remarks
	 * 问号是 MySQL 驱动的值占位符，第二个参数数组按 SQL 中的问号顺序绑定。
	 * 不要把 roleId 拼进 SQL 字符串；动态表名或列名也不能通过值占位符绑定。
	 * SQL 列名仍是 name / code，不受实体属性改名影响。
	 *
	 * @param roleId - 角色主键。
	 * @returns 角色投影；不存在时返回 null。
	 */
	async findRoleByIdByRawSqlLearning(roleId: number): Promise<RoleRow | null> {
		const sql = `
      SELECT
        id AS roleId,
        name AS roleName,
        description,
        code AS roleCode
      FROM roles
      WHERE id = ?
      LIMIT 1
    `
		const rows = await this.repository.query<RoleRow[]>(sql, [roleId])
		return rows[0] ?? null
	}
}
