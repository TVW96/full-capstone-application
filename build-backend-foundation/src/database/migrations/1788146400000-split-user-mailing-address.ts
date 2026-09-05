import { MigrationInterface, QueryRunner } from "typeorm";

export class SplitUserMailingAddress1788146400000 implements MigrationInterface {
  name = "SplitUserMailingAddress1788146400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mailing_address_line_1" varchar(255),
      ADD COLUMN IF NOT EXISTS "mailing_address_line_2" varchar(255)
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "mailing_address_line_1" = "mailing_address"
      WHERE "mailing_address_line_1" IS NULL
        AND "mailing_address" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "mailing_address_line_1" = 'Address unavailable'
      WHERE "mailing_address_line_1" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "mailing_address_line_1" SET NOT NULL,
      ALTER COLUMN "region" TYPE varchar(2)
        USING CASE
          WHEN "region" ~ '^[A-Za-z]{2}' THEN upper(left("region", 2))
          ELSE 'US'
        END,
      ALTER COLUMN "region" SET NOT NULL,
      DROP COLUMN IF EXISTS "mailing_address"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mailing_address" varchar(255)
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "mailing_address" = concat_ws(', ', "mailing_address_line_1", "mailing_address_line_2")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "region" TYPE varchar(100),
      ALTER COLUMN "region" DROP NOT NULL,
      DROP COLUMN IF EXISTS "mailing_address_line_2",
      DROP COLUMN IF EXISTS "mailing_address_line_1"
    `);
  }
}
