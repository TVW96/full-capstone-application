import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrdersAndPayments1788751200000 implements MigrationInterface {
  name = "AddOrdersAndPayments1788751200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE public.listings_status_enum ADD VALUE IF NOT EXISTS 'reserved';
      ALTER TABLE public.listings
        ADD COLUMN reserved_by_checkout_session varchar(255),
        ADD COLUMN reservation_expires_at timestamptz;
      CREATE INDEX idx_listings_reserved_checkout_session
        ON public.listings(reserved_by_checkout_session)
        WHERE reserved_by_checkout_session IS NOT NULL;
      CREATE TYPE public.orders_status_enum AS ENUM ('paid', 'refunded');
      CREATE TABLE public.orders (
        order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stripe_checkout_session_id varchar(255) NOT NULL UNIQUE,
        stripe_payment_intent_id varchar(255),
        buyer_email varchar(320),
        amount_total integer NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'usd',
        status public.orders_status_enum NOT NULL DEFAULT 'paid',
        shipping_name varchar(160),
        shipping_address jsonb,
        shipping_rate_id varchar(255),
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_orders_amount_total CHECK (amount_total >= 0)
      );
      CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
      CREATE TABLE public.order_items (
        order_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
        listing_id uuid NOT NULL REFERENCES public.listings(listing_id) ON DELETE RESTRICT,
        title varchar(160) NOT NULL,
        unit_amount integer NOT NULL,
        CONSTRAINT chk_order_items_unit_amount CHECK (unit_amount >= 0),
        CONSTRAINT uq_order_items_order_listing UNIQUE (order_id, listing_id)
      );
      CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
      CREATE INDEX idx_order_items_listing_id ON public.order_items(listing_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.order_items;
      DROP TABLE IF EXISTS public.orders;
      DROP TYPE IF EXISTS public.orders_status_enum;
      DROP INDEX IF EXISTS public.idx_listings_reserved_checkout_session;
      ALTER TABLE public.listings
        DROP COLUMN IF EXISTS reservation_expires_at,
        DROP COLUMN IF EXISTS reserved_by_checkout_session;
    `);
  }
}
