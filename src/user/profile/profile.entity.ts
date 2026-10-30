import type { Relation } from 'typeorm'
import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import User from '../user.entity.ts'

@Entity('profile')
export default class UserProfile {
	// 既是主键，也是指向 user.id 的外键；不自增。
	@PrimaryColumn({ type: 'int' })
	userId: number

	@Column({ type: 'varchar', length: 20, nullable: true })
	nickname?: string | null

	@Column({ type: 'int', nullable: true })
	gender?: 0 | 1 | null

	@Column({ type: 'varchar', length: 512, nullable: true })
	photo?: string | null

	@Column({ type: 'varchar', length: 120, nullable: true })
	address?: string | null

	@OneToOne(() => User, user => user.profile)
	@JoinColumn({ name: 'userId', referencedColumnName: 'id' })
	user: Relation<User>
}
