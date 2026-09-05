import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { CatalogProductsModule } from "./catalog-products/catalog-products.module";
import { InventoryItemsModule } from "./inventory-items/inventory-items.module";
import { ListingsModule } from "./listings/listings.module";
import { MediaModule } from "./media/media.module";
import { UsersModule } from "./users/users.module";
import { createDatabaseOptions } from "./database/database-options";
import { SellingModule } from "./selling/selling.module";
import { PaymentsModule } from "./payments/payments.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDatabaseOptions(process.env, "runtime"),
        autoLoadEntities: true,
      }),
    }),

    CatalogProductsModule,
    UsersModule,
    InventoryItemsModule,
    ListingsModule,
    MediaModule,
    SellingModule,
    PaymentsModule,
  ],
})
export class AppModule {}
