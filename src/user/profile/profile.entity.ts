import type { Relation } from 'typeorm'
import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn } from 'typeorm'
import User from '../user.entity.ts'

@Entity('profile')
export default class UserProfile {
	// 既是主键，也是指向 user.id 的外键；不自增。
	@PrimaryColumn({ type: 'int' })
	userId: number

	// 展示昵称，全局唯一；历史数据允许为空，新请求不能用 null 清空。
	@Column({ type: 'varchar', length: 20, unique: true, nullable: true })
	nickname?: string | null

	// 0 为女，1 为男，null 表示未设置。
	@Column({ type: 'int', nullable: true })
	gender?: 0 | 1 | null

	// 头像地址，null 表示未设置或已清空。
	@Column({ type: 'varchar', length: 512, nullable: true })
	photo?: string | null

	// 用户填写的地址，允许通过 PATCH 传 null 清空。
	@Column({ type: 'varchar', length: 120, nullable: true })
	address?: string | null

	// 资料属于一个用户；删除用户时数据库级联删除资料，反向删除资料不删除用户。
	@OneToOne(() => User, user => user.profile, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'userId', referencedColumnName: 'id' })
	user: Relation<User>
}
