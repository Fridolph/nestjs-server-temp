import type { Relation } from 'typeorm'
import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	OneToMany,
	ManyToMany,
	JoinTable,
	OneToOne,
	AfterInsert,
	AfterRemove,
} from 'typeorm'
import Logs from '../common/logs/logs.entity.ts'
import Roles from '../roles/roles.entity.ts'
import { IsBoolean, IsNotEmpty, IsOptional, IsString, min } from 'class-validator'
import Profile from './profile/profile.entity.ts'

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
	phone?: string

	@Column({ type: 'varchar', length: 120, nullable: true })
	@IsString()
	@IsOptional()
	@IsOptional()
	email?: string

	@Column({ type: 'varchar', length: 32, nullable: true })
	@IsString()
	@IsOptional()
	@IsNotEmpty()
	password?: string

	@Column({ type: 'boolean', default: true })
	@IsOptional()
	@IsBoolean()
	isActive?: boolean

	// typescript -> 数据库 关联关系 Mapping
	@OneToOne(() => Profile, profile => profile.user, { cascade: true })
	profile: Relation<Profile>

	@OneToMany(() => Logs, logs => logs.user)
	logs: Relation<Logs[]>

	@ManyToMany(() => Roles, roles => roles.users)
	@JoinTable({ name: 'users_roles' })
	roles: Relation<Roles[]>

	@AfterInsert()
	afterInsert() {
		console.log('afterInsert -> ', 'id: ', this.id, ', username: ', this.username)
	}

	@AfterRemove()
	afterRemove() {
		console.log('afterRemove -> ', 'id: ', this.id, ', username: ', this.username)
	}
}
