import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { AuthSessionRepository } from './auth-session.repository.ts'
import type { UserIdentity } from '../user/user.types.ts'
import { registerOutputSchema } from './dto/register.dto.ts'

export const ACCESS_SECONDS = 15 * 60
export const SESSION_SECONDS = 7 * 24 * 60 * 60
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const hashRefreshToken = (token: string) => createHash('sha256').update(token).digest('hex')

function readRefresh(token: string | undefined) {
	if (!token || token.length > 100) return null
	const [id, secret, extra] = token.split('.')
	return !extra && sessionIdPattern.test(id ?? '') && /^[A-Za-z0-9_-]{43}$/.test(secret ?? '') ? id : null
}

@Injectable()
export class AuthSessionService {
	constructor(private readonly repository: AuthSessionRepository, private readonly jwt: JwtService) {}

	/** 登录和注册共用签发；会话先落库，客户端只接收明确的身份白名单。 */
	async create(identity: UserIdentity) {
		const id = randomUUID()
		const refreshToken = `${id}.${randomBytes(32).toString('base64url')}`
		const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)
		const data = await this.accessResponse(identity, id)
		await this.repository.createSession(id, identity.userId, hashRefreshToken(refreshToken), expiresAt)
		return { data, refreshToken, expiresAt }
	}

	async refresh(token: string | undefined) {
		const id = readRefresh(token)
		if (!id) throw new UnauthorizedException('登录已失效，请重新登录')
		const refreshToken = `${id}.${randomBytes(32).toString('base64url')}`
		const session = await this.repository.rotate(id, hashRefreshToken(token!), hashRefreshToken(refreshToken))
		if (!session) throw new UnauthorizedException('登录已失效，请重新登录')
		return { data: await this.accessResponse(session.identity, id), refreshToken, expiresAt: session.expiresAt }
	}

	/** 只信任有效签名与当前数据库会话；旧版没有 sid 的 JWT 要重新登录。 */
	async validate(payload: Record<string, unknown>) {
		if (payload.tokenType !== 'access' || typeof payload.sid !== 'string' || !sessionIdPattern.test(payload.sid)
			|| !Number.isSafeInteger(payload.userId) || Number(payload.userId) < 1) {
			throw new UnauthorizedException('登录已失效，请重新登录')
		}
		const user = await this.repository.findActive(payload.sid, Number(payload.userId))
		if (!user) throw new UnauthorizedException('登录已失效，请重新登录')
		return { ...user, sessionId: payload.sid }
	}

	/** 允许 access token 已过期时退出；只忽略过期，仍验证签名和令牌用途。 */
	async logout(refreshToken: string | undefined, bearer: string | undefined) {
		const id = readRefresh(refreshToken)
		if (id) await this.repository.revoke(id, { refreshHash: hashRefreshToken(refreshToken!) })
		if (bearer) {
			let payload: Record<string, unknown>
			try { payload = await this.jwt.verifyAsync(bearer, { ignoreExpiration: true, algorithms: ['HS256'] }) }
			catch { return }
			if (payload.tokenType === 'access' && typeof payload.sid === 'string' && sessionIdPattern.test(payload.sid)
				&& Number.isSafeInteger(payload.userId) && Number(payload.userId) > 0) {
				await this.repository.revoke(payload.sid, { userId: Number(payload.userId) })
			}
		}
	}

	private async accessResponse(identity: UserIdentity, sid: string) {
		const accessToken = await this.jwt.signAsync({ ...identity, sid, tokenType: 'access' }, { expiresIn: ACCESS_SECONDS, algorithm: 'HS256' })
		return registerOutputSchema.parse({ ...identity, accessToken, tokenType: 'Bearer' })
	}
}
