import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVerificationTransactions1788924000000 implements MigrationInterface {
  name = "AddVerificationTransactions1788924000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE public.users_role_enum AS ENUM (
        'customer', 'operations', 'admin'
      );
      ALTER TABLE public.users
        ADD COLUMN role public.users_role_enum NOT NULL DEFAULT 'customer',
        ADD COLUMN stripe_connected_account_id varchar(255),
        ADD COLUMN stripe_details_submitted boolean NOT NULL DEFAULT false,
        ADD COLUMN stripe_transfers_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN stripe_payouts_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN stripe_account_updated_at timestamptz;
      CREATE UNIQUE INDEX uq_users_stripe_connected_account_id
        ON public.users(stripe_connected_account_id)
        WHERE stripe_connected_account_id IS NOT NULL;

      CREATE TABLE public.verification_locations (
        verification_location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(32) NOT NULL UNIQUE,
        name varchar(160) NOT NULL,
        address jsonb NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_verification_locations_code CHECK (
          code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'
        ),
        CONSTRAINT chk_verification_locations_address CHECK (
          jsonb_typeof(address) = 'object'
          AND address ?& ARRAY[
            'line1', 'city', 'administrativeArea', 'postalCode', 'country'
          ]
          AND address->>'country' ~ '^[A-Z]{2}$'
        )
      );

      ALTER TYPE public.orders_status_enum RENAME TO orders_status_enum_legacy;
      CREATE TYPE public.orders_status_enum AS ENUM (
        'paid',
        'payment_received',
        'awaiting_location',
        'awaiting_seller_shipment',
        'inbound_in_transit',
        'under_verification',
        'verified',
        'verification_failed',
        'outbound_shipped',
        'transfer_processing',
        'completed',
        'refund_pending',
        'refund_failed',
        'refunded',
        'disputed',
        'transfer_reversed'
      );
      ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
      ALTER TABLE public.orders
        ALTER COLUMN status TYPE public.orders_status_enum
        USING status::text::public.orders_status_enum;
      ALTER TABLE public.orders
        ALTER COLUMN status SET DEFAULT 'payment_received';
      DROP TYPE public.orders_status_enum_legacy;

      CREATE TYPE public.orders_transfer_status_enum AS ENUM (
        'blocked', 'ready', 'processing', 'released', 'failed', 'reversed'
      );
      ALTER TABLE public.orders
        ADD COLUMN stripe_charge_id varchar(255),
        ADD COLUMN stripe_transfer_group varchar(255),
        ADD COLUMN buyer_id uuid,
        ADD COLUMN seller_id uuid,
        ADD COLUMN verification_location_id uuid,
        ADD COLUMN seller_gross_amount integer NOT NULL DEFAULT 0,
        ADD COLUMN platform_fee_amount integer NOT NULL DEFAULT 0,
        ADD COLUMN seller_net_amount integer NOT NULL DEFAULT 0,
        ADD COLUMN seller_connected_account_id_snapshot varchar(255),
        ADD COLUMN transfer_status public.orders_transfer_status_enum
          NOT NULL DEFAULT 'blocked',
        ADD COLUMN stripe_transfer_id varchar(255),
        ADD COLUMN transfer_failure_reason text,
        ADD COLUMN transferred_at timestamptz,
        ADD COLUMN inbound_carrier varchar(80),
        ADD COLUMN inbound_tracking_number varchar(120),
        ADD COLUMN inbound_shipped_at timestamptz,
        ADD COLUMN received_at timestamptz,
        ADD COLUMN verification_notes text,
        ADD COLUMN verification_failure_reason text,
        ADD COLUMN verified_at timestamptz,
        ADD COLUMN outbound_carrier varchar(80),
        ADD COLUMN outbound_tracking_number varchar(120),
        ADD COLUMN outbound_shipped_at timestamptz,
        ADD COLUMN stripe_refund_id varchar(255),
        ADD COLUMN refunded_amount integer NOT NULL DEFAULT 0,
        ADD COLUMN refund_failure_reason text,
        ADD COLUMN refunded_at timestamptz,
        ADD COLUMN pre_dispute_status varchar(40),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

      WITH single_seller_orders AS (
        SELECT oi.order_id, min(l.seller_id::text)::uuid AS seller_id
        FROM public.order_items oi
        JOIN public.listings l ON l.listing_id = oi.listing_id
        GROUP BY oi.order_id
        HAVING count(DISTINCT l.seller_id) = 1
      )
      UPDATE public.orders o
      SET seller_id = sellers.seller_id
      FROM single_seller_orders sellers
      WHERE sellers.order_id = o.order_id;

      WITH merchandise_totals AS (
        SELECT order_id, sum(unit_amount)::integer AS gross_amount
        FROM public.order_items
        GROUP BY order_id
      )
      UPDATE public.orders o
      SET seller_gross_amount = totals.gross_amount,
          seller_net_amount = totals.gross_amount
      FROM merchandise_totals totals
      WHERE totals.order_id = o.order_id;

      ALTER TABLE public.orders
        ADD CONSTRAINT fk_orders_buyer
          FOREIGN KEY (buyer_id) REFERENCES public.users(user_id)
          ON DELETE RESTRICT,
        ADD CONSTRAINT fk_orders_seller
          FOREIGN KEY (seller_id) REFERENCES public.users(user_id)
          ON DELETE RESTRICT,
        ADD CONSTRAINT fk_orders_verification_location
          FOREIGN KEY (verification_location_id)
          REFERENCES public.verification_locations(verification_location_id)
          ON DELETE RESTRICT,
        ADD CONSTRAINT chk_orders_distinct_parties CHECK (
          buyer_id IS NULL OR seller_id IS NULL OR buyer_id <> seller_id
        ),
        ADD CONSTRAINT chk_orders_marketplace_amounts CHECK (
          seller_gross_amount >= 0
          AND platform_fee_amount >= 0
          AND seller_net_amount >= 0
          AND seller_gross_amount = platform_fee_amount + seller_net_amount
        ),
        ADD CONSTRAINT chk_orders_refunded_amount CHECK (
          refunded_amount >= 0 AND refunded_amount <= amount_total
        ),
        ADD CONSTRAINT chk_orders_pre_dispute_status CHECK (
          pre_dispute_status IS NULL
          OR pre_dispute_status IN (
            'paid', 'payment_received', 'awaiting_location',
            'awaiting_seller_shipment', 'inbound_in_transit',
            'under_verification', 'verified', 'verification_failed',
            'outbound_shipped', 'transfer_processing', 'completed',
            'refund_pending', 'refund_failed', 'refunded',
            'transfer_reversed'
          )
        ),
        ADD CONSTRAINT chk_orders_inbound_tracking CHECK (
          (inbound_carrier IS NULL) = (inbound_tracking_number IS NULL)
        ),
        ADD CONSTRAINT chk_orders_outbound_tracking CHECK (
          (outbound_carrier IS NULL) = (outbound_tracking_number IS NULL)
        ),
        ADD CONSTRAINT chk_orders_transfer_record CHECK (
          transfer_status NOT IN ('released', 'reversed')
          OR (stripe_transfer_id IS NOT NULL AND transferred_at IS NOT NULL)
        );
      CREATE UNIQUE INDEX uq_orders_stripe_charge_id
        ON public.orders(stripe_charge_id) WHERE stripe_charge_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_orders_stripe_transfer_group
        ON public.orders(stripe_transfer_group)
        WHERE stripe_transfer_group IS NOT NULL;
      CREATE UNIQUE INDEX uq_orders_stripe_transfer_id
        ON public.orders(stripe_transfer_id)
        WHERE stripe_transfer_id IS NOT NULL;
      CREATE UNIQUE INDEX uq_orders_stripe_refund_id
        ON public.orders(stripe_refund_id)
        WHERE stripe_refund_id IS NOT NULL;
      CREATE INDEX idx_orders_buyer_created_at
        ON public.orders(buyer_id, created_at DESC);
      CREATE INDEX idx_orders_seller_created_at
        ON public.orders(seller_id, created_at DESC);
      CREATE INDEX idx_orders_operations_queue
        ON public.orders(status, created_at);
      CREATE INDEX idx_orders_verification_location
        ON public.orders(verification_location_id, status);

      ALTER TABLE public.order_items
        ADD COLUMN seller_id uuid,
        ADD COLUMN condition_snapshot jsonb;
      UPDATE public.order_items oi
      SET seller_id = o.seller_id
      FROM public.orders o
      WHERE o.order_id = oi.order_id;
      UPDATE public.order_items oi
      SET condition_snapshot = snapshots.copies
      FROM (
        SELECT oi2.order_item_id,
          jsonb_agg(
            jsonb_build_object(
              'itemId', inventory.item_id,
              'condition', inventory.condition,
              'conditionNotes', inventory.condition_notes
            )
            ORDER BY inventory.item_id
          ) AS copies
        FROM public.order_items oi2
        JOIN public.listing_items li ON li.listing_id = oi2.listing_id
        JOIN public.inventory_items inventory ON inventory.item_id = li.item_id
        GROUP BY oi2.order_item_id
      ) snapshots
      WHERE snapshots.order_item_id = oi.order_item_id;
      ALTER TABLE public.order_items
        ADD CONSTRAINT fk_order_items_seller
          FOREIGN KEY (seller_id) REFERENCES public.users(user_id)
          ON DELETE RESTRICT;
      CREATE INDEX idx_order_items_seller_id ON public.order_items(seller_id);

      CREATE TABLE public.order_events (
        order_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id uuid NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
        event_type varchar(80) NOT NULL,
        actor_type varchar(32) NOT NULL,
        actor_user_id uuid REFERENCES public.users(user_id) ON DELETE RESTRICT,
        from_status public.orders_status_enum,
        to_status public.orders_status_enum,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_order_events_actor_type CHECK (
          actor_type IN ('system', 'buyer', 'seller', 'operations', 'stripe')
        ),
        CONSTRAINT chk_order_events_actor_user CHECK (
          (
            actor_type IN ('buyer', 'seller', 'operations')
            AND actor_user_id IS NOT NULL
          )
          OR (
            actor_type IN ('system', 'stripe')
            AND actor_user_id IS NULL
          )
        )
      );
      CREATE INDEX idx_order_events_order_created_at
        ON public.order_events(order_id, created_at);

      CREATE FUNCTION public.prevent_order_event_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $audit$
      BEGIN
        RAISE EXCEPTION 'order_events are append-only';
      END
      $audit$;
      CREATE TRIGGER order_events_append_only
        BEFORE UPDATE OR DELETE ON public.order_events
        FOR EACH ROW EXECUTE FUNCTION public.prevent_order_event_mutation();

      CREATE TYPE public.stripe_webhook_processing_status_enum AS ENUM (
        'processing', 'processed', 'failed'
      );
      CREATE TABLE public.stripe_webhook_events (
        stripe_event_id varchar(255) PRIMARY KEY,
        event_type varchar(160) NOT NULL,
        livemode boolean NOT NULL,
        connected_account_id varchar(255),
        processing_status public.stripe_webhook_processing_status_enum
          NOT NULL DEFAULT 'processing',
        attempts integer NOT NULL DEFAULT 1,
        last_error text,
        received_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_stripe_webhook_attempts CHECK (attempts > 0)
      );
      CREATE INDEX idx_stripe_webhook_retry_queue
        ON public.stripe_webhook_events(processing_status, updated_at);

      ALTER TABLE public.verification_locations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

      DO $security$
      DECLARE
        role_name text;
        table_name text;
      BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            FOREACH table_name IN ARRAY ARRAY[
              'verification_locations', 'order_events', 'stripe_webhook_events'
            ]
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

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.stripe_webhook_events;
      DROP TYPE IF EXISTS public.stripe_webhook_processing_status_enum;
      DROP TRIGGER IF EXISTS order_events_append_only ON public.order_events;
      DROP FUNCTION IF EXISTS public.prevent_order_event_mutation();
      DROP TABLE IF EXISTS public.order_events;

      ALTER TABLE public.order_items
        DROP CONSTRAINT IF EXISTS fk_order_items_seller,
        DROP COLUMN IF EXISTS condition_snapshot,
        DROP COLUMN IF EXISTS seller_id;

      DROP INDEX IF EXISTS public.idx_orders_operations_queue;
      ALTER TABLE public.orders
        DROP CONSTRAINT IF EXISTS chk_orders_transfer_record,
        DROP CONSTRAINT IF EXISTS chk_orders_outbound_tracking,
        DROP CONSTRAINT IF EXISTS chk_orders_inbound_tracking,
        DROP CONSTRAINT IF EXISTS chk_orders_pre_dispute_status,
        DROP CONSTRAINT IF EXISTS chk_orders_refunded_amount,
        DROP CONSTRAINT IF EXISTS chk_orders_marketplace_amounts,
        DROP CONSTRAINT IF EXISTS chk_orders_distinct_parties,
        DROP CONSTRAINT IF EXISTS fk_orders_verification_location,
        DROP CONSTRAINT IF EXISTS fk_orders_seller,
        DROP CONSTRAINT IF EXISTS fk_orders_buyer;
      ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
      ALTER TYPE public.orders_status_enum RENAME TO orders_status_enum_workflow;
      CREATE TYPE public.orders_status_enum AS ENUM ('paid', 'refunded');
      ALTER TABLE public.orders
        ALTER COLUMN status TYPE public.orders_status_enum
        USING (
          CASE WHEN status::text = 'refunded' THEN 'refunded' ELSE 'paid' END
        )::public.orders_status_enum;
      ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'paid';
      DROP TYPE public.orders_status_enum_workflow;
      ALTER TABLE public.orders
        DROP COLUMN IF EXISTS updated_at,
        DROP COLUMN IF EXISTS pre_dispute_status,
        DROP COLUMN IF EXISTS refunded_at,
        DROP COLUMN IF EXISTS refund_failure_reason,
        DROP COLUMN IF EXISTS refunded_amount,
        DROP COLUMN IF EXISTS stripe_refund_id,
        DROP COLUMN IF EXISTS outbound_shipped_at,
        DROP COLUMN IF EXISTS outbound_tracking_number,
        DROP COLUMN IF EXISTS outbound_carrier,
        DROP COLUMN IF EXISTS verified_at,
        DROP COLUMN IF EXISTS verification_failure_reason,
        DROP COLUMN IF EXISTS verification_notes,
        DROP COLUMN IF EXISTS received_at,
        DROP COLUMN IF EXISTS inbound_shipped_at,
        DROP COLUMN IF EXISTS inbound_tracking_number,
        DROP COLUMN IF EXISTS inbound_carrier,
        DROP COLUMN IF EXISTS transferred_at,
        DROP COLUMN IF EXISTS transfer_failure_reason,
        DROP COLUMN IF EXISTS stripe_transfer_id,
        DROP COLUMN IF EXISTS transfer_status,
        DROP COLUMN IF EXISTS seller_connected_account_id_snapshot,
        DROP COLUMN IF EXISTS seller_net_amount,
        DROP COLUMN IF EXISTS platform_fee_amount,
        DROP COLUMN IF EXISTS seller_gross_amount,
        DROP COLUMN IF EXISTS verification_location_id,
        DROP COLUMN IF EXISTS seller_id,
        DROP COLUMN IF EXISTS buyer_id,
        DROP COLUMN IF EXISTS stripe_transfer_group,
        DROP COLUMN IF EXISTS stripe_charge_id;
      DROP TYPE IF EXISTS public.orders_transfer_status_enum;
      DROP TABLE IF EXISTS public.verification_locations;

      DROP INDEX IF EXISTS public.uq_users_stripe_connected_account_id;
      ALTER TABLE public.users
        DROP COLUMN IF EXISTS stripe_account_updated_at,
        DROP COLUMN IF EXISTS stripe_payouts_enabled,
        DROP COLUMN IF EXISTS stripe_transfers_enabled,
        DROP COLUMN IF EXISTS stripe_details_submitted,
        DROP COLUMN IF EXISTS stripe_connected_account_id,
        DROP COLUMN IF EXISTS role;
      DROP TYPE IF EXISTS public.users_role_enum;
    `);
  }
}
