import { MigrationInterface, QueryRunner } from "typeorm";

export class Menus21794922462642 implements MigrationInterface {
    name = 'Menus21794922462642'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`type\` \`type\` enum ('directory', 'group', 'page') NOT NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`menus\` CHANGE \`type\` \`type\` enum ('directory', 'page') NOT NULL
        `);
    }

}
