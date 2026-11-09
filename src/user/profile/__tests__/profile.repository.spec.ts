import 'reflect-metadata'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import type { Repository } from 'typeorm'
import ProfileRpst from '../profile.repository.ts'
import UserProfile from '../profile.entity.ts'

describe.each(['typeorm', 'sql'] as const)('资料部分更新：%s', implementation => {
	function fixture(affected: number, exists: boolean) {
		const store = {
			update: vi.fn().mockResolvedValue({ affected }),
			query: vi.fn().mockResolvedValue({ affectedRows: affected }),
			existsBy: vi.fn().mockResolvedValue(exists),
		}
		const repository = new ProfileRpst(store as unknown as Repository<UserProfile>)
		const update = implementation === 'typeorm'
			? repository.updateProfile.bind(repository)
			: repository.updateProfileWithSql.bind(repository)
		return { store, update }
	}

	it('资料不存在时抛出 404', async () => {
		const { store, update } = fixture(0, false)
		await expect(update(999, { address: '新地址' })).rejects.toBeInstanceOf(NotFoundException)
		expect(store.existsBy).toHaveBeenCalledWith({ userId: 999 })
	})

	it('原值重复提交即使报告 0 行也成功', async () => {
		const { update } = fixture(0, true)
		await expect(update(18, { nickname: 'alice' })).resolves.toBe(0)
	})

	it('更新成功不额外查询，保留 null 和 0，不写入未提供的昵称', async () => {
		const { store, update } = fixture(1, true)
		await expect(update(18, { gender: 0, photo: null })).resolves.toBe(1)
		expect(store.existsBy).not.toHaveBeenCalled()
		if (implementation === 'typeorm') {
			expect(store.update).toHaveBeenCalledWith({ userId: 18 }, { gender: 0, photo: null })
		} else {
			expect(store.query.mock.calls[0][1]).toEqual([0, null, 18])
			expect(store.query.mock.calls[0][0]).not.toContain('nickname')
		}
	})

	it('空更新不能执行 SQL', async () => {
		const { store, update } = fixture(1, true)
		await expect(update(18, {})).rejects.toBeInstanceOf(BadRequestException)
		expect(store.update).not.toHaveBeenCalled()
		expect(store.query).not.toHaveBeenCalled()
	})
})
