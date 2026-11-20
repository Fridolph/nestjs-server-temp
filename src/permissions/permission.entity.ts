import { CaslResource } from '../common/decorators/casl-resource.decorator.ts'
import {
	type Relation,
	Column,
	CreateDateColumn,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm'
import { CaslAction } from '../common/constants/casl.ts'
import Roles from '../roles/roles.entity.ts'

@CaslResource({
	name: 'permissions',
	actions: [CaslAction.Read],
	fields: ['code', 'name', 'resource', 'action', 'enabled', 'fields'],
})
@Entity('permissions')
export class Permissions {
	// 权限目录主键。
	@PrimaryGeneratedColumn()
	id: number

	// 稳定且唯一的权限编码，供角色分配与前端展示。
	@Column({ type: 'varchar', length: 64, unique: true })
	code: string

	// 权限展示名称。
	@Column({ type: 'varchar', length: 64 })
	name: string

	// 必须对应 CaslResource 声明的稳定标识。
	@Column({ type: 'varchar', length: 64 })
	resource: string

	// 每条权限对应一个动作；manage 仅由超管分支构建。
	@Column({ type: 'enum', enum: CaslAction })
	action: CaslAction

	// 禁用后下一次授权查询不再授予。
	@Column({ type: 'boolean', default: true })
	enabled: boolean

	// null 表示不限制字段；非空数组表示允许的字段集合。
	@Column({ type: 'json', nullable: true })
	fields: string[] | null

	// 目录创建时间，不替代授权变更审计。
	@CreateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
	})
	createdAt: Date

	// 目录最近修改时间；关联授权变化不会自动更新此值。
	@UpdateDateColumn({
		type: 'datetime',
		precision: 3,
		default: () => 'CURRENT_TIMESTAMP(3)',
		onUpdate: 'CURRENT_TIMESTAMP(3)',
	})
	updatedAt: Date

	// 共享该权限的角色；中间表联合主键拒绝重复授权。
	@ManyToMany(() => Roles, roles => roles.permissions)
	@JoinTable({
		name: 'roles_permissions',
		joinColumn: {
			name: 'permissionId',
			referencedColumnName: 'id',
		},
		inverseJoinColumn: {
			name: 'roleId',
			referencedColumnName: 'id',
		},
	})
	role: Relation<Roles[]>
}
