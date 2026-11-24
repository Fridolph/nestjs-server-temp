import { CaslAction } from '../common/constants/casl.ts'
import { CaslResource } from '../common/decorators/casl-resource.decorator.ts'
import type { Relation } from 'typeorm'
import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	Index,
	OneToMany,
	ManyToOne,
	JoinColumn,
	OneToOne,
	AfterInsert,
	AfterRemove,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm'
import Logs from '../common/logs/logs.entity.ts'
import Roles from '../roles/roles.entity.ts'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import Profile from './profile/profile.entity.ts'

@CaslResource({
	name: 'users',
	label: '用户',
	actions: [CaslAction.Read, CaslAction.Create, CaslAction.Update, CaslAction.Delete],
	fields: ['id', 'username', 'phone', 'email', 'isActive'],
})
@Entity()
export default class User {
	@PrimaryGeneratedColumn('increment')
	id: number

	@Column({ type: 'varchar', length: 30, unique: true })
	@IsString()
	@IsNotEmpty()
	username: string

	@Column({ type: 'varchar', length: 11, nullable: true })
	@IsString()
	@IsOptional()
	@IsOptional()
	phone?: string | null

	@Column({ type: 'varchar', length: 120, nullable: true })
	@IsString()
	@IsOptional()
	@IsOptional()
	email?: string | null

	@Column({ type: 'varchar', length: 255, nullable: true })
	@IsString()
	@IsOptional()
	@IsNotEmpty()
	password?: string

	@Column({ type: 'boolean', default: true })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean

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

	// typescript -> 数据库 关联关系 Mapping
	@OneToOne(() => Profile, profile => profile.user, { cascade: true })
	profile: Relation<Profile>

	@OneToMany(() => Logs, logs => logs.user, { cascade: true })
	logs: Relation<Logs[]>

	// 单个用户恰好一个角色；角色删除受外键保护，不级联删除用户。
	@Index('IDX_user_roleId')
	@Column({ type: 'int' })
	roleId: number

	@ManyToOne(() => Roles, roles => roles.users, { nullable: false, onDelete: 'RESTRICT' })
	@JoinColumn({ name: 'roleId', foreignKeyConstraintName: 'FK_user_role' })
	role: Relation<Roles>

	@AfterInsert()
	afterInsert() {
		console.log('afterInsert -> ', 'id: ', this.id, ', username: ', this.username)
	}

	@AfterRemove()
	afterRemove() {
		console.log('afterRemove -> ', 'id: ', this.id, ', username: ', this.username)
	}
}
