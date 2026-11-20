import { MigrationInterface, QueryRunner } from "typeorm";

export class CaslModule1795159836491 implements MigrationInterface {
    name = 'CaslModule1795159836491'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`user\`
            ADD \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        `);
        await queryRunner.query(`
            ALTER TABLE \`user\`
            ADD \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
        `);
        await queryRunner.query(`
            ALTER TABLE \`roles\`
            ADD \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        `);
        await queryRunner.query(`
            ALTER TABLE \`roles\`
            ADD \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_8dad765629e83229da6feda1c1\` ON \`permissions\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`code\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`code\` varchar(64) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD UNIQUE INDEX \`IDX_8dad765629e83229da6feda1c1\` (\`code\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`name\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`name\` varchar(64) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`resource\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`resource\` varchar(64) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` CHANGE \`action\` \`action\` enum (
                    'manage',
                    'create',
                    'read',
                    'update',
                    'delete',
                    'export'
                ) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` CHANGE \`enabled\` \`enabled\` tinyint NOT NULL DEFAULT 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`permissions\` CHANGE \`enabled\` \`enabled\` tinyint NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` CHANGE \`action\` \`action\` enum ('manage', 'create', 'read', 'update', 'delete') NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`resource\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`resource\` varchar(255) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`name\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`name\` varchar(255) NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP INDEX \`IDX_8dad765629e83229da6feda1c1\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\` DROP COLUMN \`code\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`permissions\`
            ADD \`code\` varchar(255) NOT NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`IDX_8dad765629e83229da6feda1c1\` ON \`permissions\` (\`code\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`roles\` DROP COLUMN \`updatedAt\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`roles\` DROP COLUMN \`createdAt\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`user\` DROP COLUMN \`updatedAt\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`user\` DROP COLUMN \`createdAt\`
        `);
    }

}
