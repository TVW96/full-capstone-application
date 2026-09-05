import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Listing } from "./entities/listing.entity";
import { ListingItem } from "./entities/listing-item.entity";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([Listing, ListingItem])],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
