import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAddresses1788232800000 implements MigrationInterface {
  name = "AddUserAddresses1788232800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "user_addresses" (
        "address_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "label" varchar(60) NOT NULL DEFAULT 'Primary',
        "address_line_1" varchar(255) NOT NULL,
        "address_line_2" varchar(255),
        "city" varchar(100) NOT NULL DEFAULT '',
        "administrative_area" varchar(100),
        "postal_code" varchar(24) NOT NULL DEFAULT '',
        "country" varchar(2) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_addresses" PRIMARY KEY ("address_id"),
        CONSTRAINT "FK_user_addresses_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "user_addresses" (
        "user_id", "label", "address_line_1", "address_line_2",
        "country", "is_default"
      )
      SELECT "user_id", 'Primary', "mailing_address_line_1",
        "mailing_address_line_2", "region", true
      FROM "users"
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_addresses_user_id"
      ON "user_addresses" ("user_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_addresses"`);
  }
}
