import type { Relation } from 'typeorm'
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm'
import User from '../user.entity.ts'

@Entity()
export default class Roles {
	@PrimaryGeneratedColumn()
	/** 角色主键。 */
	id: number

	/** 页面展示名称，可修改。 */
	@Column({ type: 'varchar', length: 32 })
	name: string

	/** 授权使用的稳定编码，创建后不可修改且全局唯一。 */
	@Column({
		type: 'varchar',
		length: 32,
		nullable: false,
		unique: true,
	})
	code: string

	/** 角色能力的简要说明。 */
	@Column({ type: 'varchar', length: 255 })
	description: string

	/** 被分配该角色的用户；删除前必须确保关联为空。 */
	@ManyToMany(() => User, user => user.roles)
	users: Relation<User[]>
}
