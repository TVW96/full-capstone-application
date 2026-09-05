import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Headers,
  ForbiddenException,
} from "@nestjs/common";

import { CreateListingDto } from "./dto/create-listing.dto";
import { ListingsService } from "./listings.service";
import { UsersService } from "../users/users.service";

@Controller("listings")
export class ListingsController {
  constructor(
    private readonly listingsService: ListingsService,
    private readonly usersService: UsersService,
  ) {}

  @Post("seller/:sellerId")
  async create(
    @Param("sellerId") sellerId: string,
    @Body() createListingDto: CreateListingDto,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.usersService.requireAuthenticatedUser(
      authorization?.replace(/^Bearer\s+/i, "").trim() ?? "",
    );
    if (sellerId !== user.userId)
      throw new ForbiddenException("You may only create your own listings.");
    return this.listingsService.create(user.userId, createListingDto);
  }

  @Get()
  findAll() {
    return this.listingsService.findAll();
  }

  @Get(":listingId")
  findOne(@Param("listingId") listingId: string) {
    return this.listingsService.findOne(listingId);
  }

  @Delete(":listingId/items/:itemId")
  async removeItem(
    @Param("listingId") listingId: string,
    @Param("itemId") itemId: string,
    @Headers("authorization") authorization?: string,
  ) {
    const user = await this.usersService.requireAuthenticatedUser(
      authorization?.replace(/^Bearer\s+/i, "").trim() ?? "",
    );

    return this.listingsService.removeItem(listingId, itemId, user.userId);
  }
}
