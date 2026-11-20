import { MigrationInterface, QueryRunner } from "typeorm";

export class Casl1795079083923 implements MigrationInterface {
    name = 'Casl1795079083923'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\` DROP COLUMN \`acl\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menus\`
            ADD \`acl\` varchar(50) NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\` DROP COLUMN \`acl\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menus\`
            ADD \`acl\` enum ('manage', 'create', 'read', 'update', 'delete') NOT NULL
        `);
    }

}
