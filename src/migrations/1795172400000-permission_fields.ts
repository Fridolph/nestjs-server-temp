import type { MigrationInterface, QueryRunner } from 'typeorm'

/** 补齐字段授权列；兼容练习过程中已经手动添加 JSON / varchar 列的数据库。 */
export class PermissionFields1795172400000 implements MigrationInterface {
	name = 'PermissionFields1795172400000'

	async up(queryRunner: QueryRunner): Promise<void> {
		const table = await queryRunner.getTable('permissions')
		if (!table) throw new Error('请先执行创建 permissions 的迁移')
		const column = table.findColumnByName('fields')
		if (!column) {
			await queryRunner.query('ALTER TABLE `permissions` ADD `fields` json NULL')
			return
		}
		// MySQL DDL 不能依赖事务完整回滚；先验证全部已有值，再执行保留数据的类型变更。
		const rows = (await queryRunner.query(
			'SELECT `fields` FROM `permissions` WHERE `fields` IS NOT NULL'
		)) as { fields: unknown }[]
		for (const row of rows) {
			let fields = row.fields
			if (typeof fields === 'string') {
				try {
					fields = JSON.parse(fields)
				} catch {
					throw new Error('permissions.fields 存在非 JSON 数据，请先人工修正')
				}
			}
			if (
				!Array.isArray(fields) ||
				!fields.length ||
				fields.some(field => typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) ||
				new Set(fields).size !== fields.length
			) {
				throw new Error('permissions.fields 必须为非空且不重复的字段数组，或 SQL NULL')
			}
		}
		if (column.type !== 'json' || !column.isNullable) {
			await queryRunner.query('ALTER TABLE `permissions` MODIFY `fields` json NULL')
		}
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		// 保留授权字段数据，回退为 JSON 文本；不会删列，也不会恢复手动改表前的未知状态。
		await queryRunner.query('ALTER TABLE `permissions` MODIFY `fields` longtext NULL')
	}
}
