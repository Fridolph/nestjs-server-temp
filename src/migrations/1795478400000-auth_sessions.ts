import { Table, type MigrationInterface, type QueryRunner } from 'typeorm'

/** 仅新增设备会话表，不修改现有用户及权限数据。 */
export class AuthSessions1795478400000 implements MigrationInterface {
	name = 'AuthSessions1795478400000'
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.createTable(new Table({
			name: 'auth_sessions',
			columns: [
				{ name: 'id', type: 'char', length: '36', isPrimary: true },
				{ name: 'userId', type: 'int' },
				{ name: 'refreshHash', type: 'char', length: '64' },
				{ name: 'expiresAt', type: 'datetime', precision: 3 },
				{ name: 'revokedAt', type: 'datetime', precision: 3, isNullable: true },
				{ name: 'createdAt', type: 'datetime', precision: 3, default: 'CURRENT_TIMESTAMP(3)' },
			],
			indices: [{ name: 'IDX_auth_sessions_userId', columnNames: ['userId'] }],
			foreignKeys: [{ name: 'FK_auth_sessions_user', columnNames: ['userId'], referencedTableName: 'user', referencedColumnNames: ['id'], onDelete: 'CASCADE' }],
		}))
	}
	async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.dropTable('auth_sessions') }
}
