import { MigrationInterface, QueryRunner } from 'typeorm'

export class Menus1794920484589 implements MigrationInterface {
	name = 'Menus1794920484589'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`createdAt\` \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        `)
		await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`updatedAt\` \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
        `)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
        `)
		await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        `)
	}
}
