import { MigrationInterface, QueryRunner } from 'typeorm'

export class CaslSql1795159211239 implements MigrationInterface {
	name = 'CaslSql1795159211239'

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
            ALTER TABLE \`users_roles\` DROP FOREIGN KEY \`FK_4efec0b51b4942045d4b894c435\`
        `)
		await queryRunner.query(`
            DROP INDEX \`IDX_4efec0b51b4942045d4b894c43\` ON \`users_roles\`
        `)
		await queryRunner.query(`
            ALTER TABLE \`users_roles\` CHANGE \`roleId\` \`roleId\` int NOT NULL
        `)
		await queryRunner.query(`
            CREATE TABLE \`permissions\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`code\` varchar(255) NOT NULL,
                \`name\` varchar(255) NOT NULL,
                \`resource\` varchar(255) NOT NULL,
                \`action\` enum ('manage', 'create', 'read', 'update', 'delete') NOT NULL,
                \`enabled\` tinyint NOT NULL,
                \`createdAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                \`updatedAt\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
                UNIQUE INDEX \`IDX_8dad765629e83229da6feda1c1\` (\`code\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE = InnoDB
        `)
		await queryRunner.query(`
            CREATE TABLE \`roles_permissions\` (
                \`permissionId\` int NOT NULL,
                \`roleId\` int NOT NULL,
                INDEX \`IDX_31cf5c31d0096f706e3ba3b1e8\` (\`permissionId\`),
                INDEX \`IDX_28bf280551eb9aa82daf1e156d\` (\`roleId\`),
                PRIMARY KEY (\`permissionId\`, \`roleId\`)
            ) ENGINE = InnoDB
        `)
		await queryRunner.query(`
            CREATE INDEX \`IDX_4fb14631257670efa14b15a3d8\` ON \`users_roles\` (\`roleId\`)
        `)
		await queryRunner.query(`
            ALTER TABLE \`users_roles\`
            ADD CONSTRAINT \`FK_4fb14631257670efa14b15a3d86\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        `)
		await queryRunner.query(`
            ALTER TABLE \`roles_permissions\`
            ADD CONSTRAINT \`FK_31cf5c31d0096f706e3ba3b1e82\` FOREIGN KEY (\`permissionId\`) REFERENCES \`permissions\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        `)
		await queryRunner.query(`
            ALTER TABLE \`roles_permissions\`
            ADD CONSTRAINT \`FK_28bf280551eb9aa82daf1e156d9\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        `)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
            ALTER TABLE \`roles_permissions\` DROP FOREIGN KEY \`FK_28bf280551eb9aa82daf1e156d9\`
        `)
		await queryRunner.query(`
            ALTER TABLE \`roles_permissions\` DROP FOREIGN KEY \`FK_31cf5c31d0096f706e3ba3b1e82\`
        `)
		await queryRunner.query(`
            ALTER TABLE \`users_roles\` DROP FOREIGN KEY \`FK_4fb14631257670efa14b15a3d86\`
        `)
		await queryRunner.query(`
            DROP INDEX \`IDX_4fb14631257670efa14b15a3d8\` ON \`users_roles\`
        `)
		await queryRunner.query(`
            DROP INDEX \`IDX_28bf280551eb9aa82daf1e156d\` ON \`roles_permissions\`
        `)
		await queryRunner.query(`
            DROP INDEX \`IDX_31cf5c31d0096f706e3ba3b1e8\` ON \`roles_permissions\`
        `)
		await queryRunner.query(`
            DROP TABLE \`roles_permissions\`
        `)
		await queryRunner.query(`
            DROP INDEX \`IDX_8dad765629e83229da6feda1c1\` ON \`permissions\`
        `)
		await queryRunner.query(`
            DROP TABLE \`permissions\`
        `)
		await queryRunner.query(`
            ALTER TABLE \`users_roles\` CHANGE \`roleId\` \`roleId\` int NOT NULL
        `)
		await queryRunner.query(`
            CREATE INDEX \`IDX_4efec0b51b4942045d4b894c43\` ON \`users_roles\` (\`roleId\`)
        `)
		await queryRunner.query(`
            ALTER TABLE \`users_roles\`
            ADD CONSTRAINT \`FK_4efec0b51b4942045d4b894c435\` FOREIGN KEY (\`roleId\`) REFERENCES \`roles\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        `)
	}
}
