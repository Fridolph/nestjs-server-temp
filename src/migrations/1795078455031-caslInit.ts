import { MigrationInterface, QueryRunner } from "typeorm";

export class CaslInit1795078455031 implements MigrationInterface {
    name = 'CaslInit1795078455031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\`
            ADD \`acl\` enum ('manage', 'create', 'read', 'update', 'delete') NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\` DROP COLUMN \`acl\`
        `);
    }

}
