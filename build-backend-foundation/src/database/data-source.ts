import "dotenv/config";

import { DataSource } from "typeorm";

import { createDatabaseOptions } from "./database-options.js";
import { ApplicationSchemaBaseline1788492000000 } from "./migrations/1788492000000-application-schema-baseline.js";
import { SecureSupabaseSchema1788578400000 } from "./migrations/1788578400000-secure-supabase-schema.js";
import { SecureMigrationHistory1788664800000 } from "./migrations/1788664800000-secure-migration-history.js";
import { AddOrdersAndPayments1788751200000 } from "./migrations/1788751200000-add-orders-and-payments.js";
import { SecurePaymentTables1788837600000 } from "./migrations/1788837600000-secure-payment-tables.js";

export default new DataSource({
  ...createDatabaseOptions(process.env, "migration"),
  migrations: [
    ApplicationSchemaBaseline1788492000000,
    SecureSupabaseSchema1788578400000,
    SecureMigrationHistory1788664800000,
    AddOrdersAndPayments1788751200000,
    SecurePaymentTables1788837600000,
  ],
});
