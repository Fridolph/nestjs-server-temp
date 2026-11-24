import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm'
import User from '../user/user.entity.ts'

/** 每次登录对应一个可独立撤销的设备会话；原始 refresh token 永不落库。 */
@Entity('auth_sessions')
export class AuthSession {
	// 随机会话标识，同时放入 access token 的 sid。
	@PrimaryColumn({ type: 'char', length: 36 })
	id: string

	// 用户删除时一并删除会话，不在用户实体上增加级联写入。
	@Index('IDX_auth_sessions_userId')
	@Column({ type: 'int' })
	userId: number

	@ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId', foreignKeyConstraintName: 'FK_auth_sessions_user' })
	user: Relation<User>

	// 高熵随机 refresh token 的 SHA-256 摘要。
	@Column({ type: 'char', length: 64, select: false })
	refreshHash: string

	// 固定绝对过期时间，续期不无限延长会话。
	@Column({ type: 'datetime', precision: 3 })
	expiresAt: Date

	// 非空即撤销，旧 JWT 和 refresh token 都不再接受。
	@Column({ type: 'datetime', precision: 3, nullable: true })
	revokedAt: Date | null

	@CreateDateColumn({ type: 'datetime', precision: 3, default: () => 'CURRENT_TIMESTAMP(3)' })
	createdAt: Date
}
