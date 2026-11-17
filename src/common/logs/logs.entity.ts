import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import type { Relation } from 'typeorm'
import User from '../../user/user.entity.ts'

@Entity()
export default class Logs {
	@PrimaryGeneratedColumn()
	id: number

	@Column()
	path: string

	@Column({ enum: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'] })
	method: string

	@Column({ type: 'text', nullable: true })
	data: string

	@Column({ type: 'text', nullable: true })
	result: string

	@ManyToOne(() => User, user => user.logs)
	@JoinColumn()
	user: Relation<User>
}
