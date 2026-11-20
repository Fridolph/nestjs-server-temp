import { CaslAction } from '../constants/casl.ts'
import { CaslResource } from '../decorators/casl-resource.decorator.ts'
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import type { Relation } from 'typeorm'
import User from '../../user/user.entity.ts'

@CaslResource({
	name: 'logs',
	actions: [CaslAction.Read, CaslAction.Export, CaslAction.Delete],
	fields: ['id', 'path', 'method'],
})
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
