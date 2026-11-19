import type { Relation } from 'typeorm'
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm'
import User from '../user/user.entity.ts'
import { Menus } from '../menus/menus.entity.ts'

@Entity()
export default class Roles {
	/** 角色主键。 */
	@PrimaryGeneratedColumn()
	id: number

	/** 页面展示名称，可修改。 */
	@Column({ name: 'name', type: 'varchar', length: 32 })
	roleName: string

	/** 授权使用的稳定编码，创建后不可修改且全局唯一。 */
	@Column({
		name: 'code',
		type: 'varchar',
		length: 32,
		nullable: false,
		unique: true,
	})
	roleCode: string

	/** 角色能力的简要说明。 */
	@Column({ type: 'varchar', length: 255 })
	description: string

	/** 被分配该角色的用户；删除前必须确保关联为空。 */
	@ManyToMany(() => User, user => user.roles)
	users: Relation<User[]>

	@ManyToMany(() => Menus, menus => menus.role)
	menus: Relation<Menus[]>
}
