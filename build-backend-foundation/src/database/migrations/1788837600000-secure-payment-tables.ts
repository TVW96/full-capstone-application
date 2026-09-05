import { MigrationInterface, QueryRunner } from "typeorm";

export class SecurePaymentTables1788837600000 implements MigrationInterface {
  name = "SecurePaymentTables1788837600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

      DO $security$
      DECLARE
        role_name text;
        table_name text;
      BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            FOREACH table_name IN ARRAY ARRAY['orders', 'order_items']
            LOOP
              EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
                table_name,
                role_name
              );
            END LOOP;
          END IF;
        END LOOP;
      END
      $security$;
    `);
  }

  async down(): Promise<void> {
    // Payment records remain locked down during rollback by design.
  }
}
