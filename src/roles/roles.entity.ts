import { CaslAction } from '../common/constants/casl.ts'
import { CaslResource } from '../common/decorators/casl-resource.decorator.ts'
import type { Relation } from 'typeorm'
import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	ManyToMany,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'
import User from '../user/user.entity.ts'
import { Menus } from '../menus/menus.entity.ts'
import { Permissions } from '../permissions/permission.entity.ts'

@CaslResource({
	name: 'roles',
	actions: [CaslAction.Read, CaslAction.Create, CaslAction.Update, CaslAction.Delete],
	fields: ['roleName', 'description'],
})
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

	@CreateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
	})
	createdAt: Date

	@UpdateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
		onUpdate: 'CURRENT_TIMESTAMP(3)',
	})
	updatedAt: Date

	/** 被分配该角色的用户；删除前必须确保关联为空。 */
	@ManyToMany(() => User, user => user.role)
	users: Relation<User[]>

	@ManyToMany(() => Permissions, permissions => permissions.role)
	permissions: Relation<Permissions[]>

	@ManyToMany(() => Menus, menus => menus.role)
	menus: Relation<Menus[]>
}
