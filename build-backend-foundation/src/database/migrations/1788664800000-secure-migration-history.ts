import { MigrationInterface, QueryRunner } from "typeorm";

export class SecureMigrationHistory1788664800000 implements MigrationInterface {
  name = "SecureMigrationHistory1788664800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

      DO $security$
      DECLARE
        role_name text;
      BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format(
              'REVOKE ALL PRIVILEGES ON TABLE public.migrations FROM %I',
              role_name
            );
          END IF;
        END LOOP;
      END
      $security$;
    `);
  }

  async down(): Promise<void> {
    // Do not weaken migration-history security during a rollback.
  }
}
