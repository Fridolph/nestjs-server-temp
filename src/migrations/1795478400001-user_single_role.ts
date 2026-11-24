import { Table, TableColumn, TableForeignKey, TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm'

/** 用户唯一角色迁入 user.roleId；多角色数据必须由维护者先明确收敛，迁移不猜测保留项。 */
export class UserSingleRole1795478400001 implements MigrationInterface {
	name = 'UserSingleRole1795478400001'
	async up(queryRunner: QueryRunner): Promise<void> {
		// MySQL DDL 会隐式提交，必须在任何表结构变更前检查数据，避免迁移到一半才发现歧义。
		const invalid = await queryRunner.query(`
			SELECT u.id FROM user u LEFT JOIN users_roles ur ON ur.userId = u.id
			GROUP BY u.id HAVING COUNT(ur.roleId) <> 1
		`)
		if (invalid.length) throw new Error('单角色迁移要求每个用户恰好一个角色，请先检查 users_roles')
		await queryRunner.addColumn('user', new TableColumn({ name: 'roleId', type: 'int', isNullable: true }))
		await queryRunner.query('UPDATE user u JOIN users_roles ur ON ur.userId = u.id SET u.roleId = ur.roleId')
		await queryRunner.changeColumn('user', 'roleId', new TableColumn({ name: 'roleId', type: 'int', isNullable: false }))
		await queryRunner.createIndex('user', new TableIndex({ name: 'IDX_user_roleId', columnNames: ['roleId'] }))
		await queryRunner.createForeignKey('user', new TableForeignKey({
			name: 'FK_user_role', columnNames: ['roleId'], referencedTableName: 'roles', referencedColumnNames: ['id'], onDelete: 'RESTRICT',
		}))
		await queryRunner.dropTable('users_roles')
	}

	/** 回滚还原当前唯一角色的中间表映射，不恢复迁移前经人工舍弃的多角色关联。 */
	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.createTable(new Table({
			name: 'users_roles',
			columns: [{ name: 'userId', type: 'int', isPrimary: true }, { name: 'roleId', type: 'int', isPrimary: true }],
			foreignKeys: [
				{ columnNames: ['userId'], referencedTableName: 'user', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
				{ columnNames: ['roleId'], referencedTableName: 'roles', referencedColumnNames: ['id'], onDelete: 'RESTRICT' },
			],
		}))
		await queryRunner.query('INSERT INTO users_roles (userId, roleId) SELECT id, roleId FROM user')
		await queryRunner.dropForeignKey('user', 'FK_user_role')
		await queryRunner.dropIndex('user', 'IDX_user_roleId')
		await queryRunner.dropColumn('user', 'roleId')
	}
}
