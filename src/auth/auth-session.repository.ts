import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { timingSafeEqual } from 'node:crypto'
import { AuthSession } from './auth-session.entity.ts'
import type { UserIdentity } from '../user/user.types.ts'

interface IdentityRow { userId: number; username: string; roleId: number }
function identity(rows: IdentityRow[]): UserIdentity | null {
	if (!rows.length) return null
	return { userId: rows[0].userId, username: rows[0].username, roleId: rows[0].roleId }
}

@Injectable()
export class AuthSessionRepository {
	constructor(@InjectRepository(AuthSession) private readonly repository: Repository<AuthSession>) {}

	createSession(id: string, userId: number, refreshHash: string, expiresAt: Date) {
		return this.repository.insert({ id, userId, refreshHash, expiresAt, revokedAt: null })
	}

	/** 每次 JWT 鉴权读取会话及当前用户状态；不缓存撤销结果，撤销提交后的下一次鉴权立即拒绝。 */
	async findActive(id: string, userId: number): Promise<UserIdentity | null> {
		// 与写入使用同一驱动的 Date 转换，避免 MySQL 会话时区与 Node 时区不同。
		return identity(await this.repository.query<IdentityRow[]>(`
			SELECT u.id AS userId, u.username, u.roleId
			FROM auth_sessions s JOIN user u ON u.id = s.userId
			WHERE s.id = ? AND s.userId = ? AND s.revokedAt IS NULL
			  AND s.expiresAt > ? AND u.isActive = 1
		`, [id, userId, new Date()]))
	}

	/**
	 * 同一事务内锁定会话、核对旧摘要并轮换。旧 refresh token 再次使用会撤销整个会话。
	 * 返回失败而不在事务中抛错，确保重放检测产生的撤销能提交；原始 token 不进入 SQL。
	 */
	rotate(id: string, oldHash: string, nextHash: string): Promise<{ identity: UserIdentity; expiresAt: Date } | null> {
		return this.repository.manager.transaction(async manager => {
			const repository = manager.getRepository(AuthSession)
			const session = await repository.createQueryBuilder('session').addSelect('session.refreshHash')
				.where('session.id = :id', { id }).setLock('pessimistic_write').getOne()
			if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null
			if (!timingSafeEqual(Buffer.from(session.refreshHash, 'hex'), Buffer.from(oldHash, 'hex'))) {
				await repository.update(id, { revokedAt: new Date() })
				return null
			}
			const user = identity(await manager.query<IdentityRow[]>(`
				SELECT u.id AS userId, u.username, u.roleId FROM user u
				WHERE u.id = ? AND u.isActive = 1
			`, [session.userId]))
			if (!user) {
				await repository.update(id, { revokedAt: new Date() })
				return null
			}
			await repository.update(id, { refreshHash: nextHash })
			return { identity: user, expiresAt: session.expiresAt }
		})
	}

	/** Bearer 已验签时按身份撤销；Cookie 则必须匹配当前摘要。重复退出不会改变结果。 */
	async revoke(id: string, credential: { userId: number } | { refreshHash: string }) {
		await this.repository.update({ id, ...credential }, { revokedAt: new Date() })
	}
}
