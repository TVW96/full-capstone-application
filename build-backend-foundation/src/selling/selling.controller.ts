import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { AvatarUpload } from "../media/media.service";
import { PublishListingDto } from "./dto/publish-listing.dto";
import { SellingService } from "./selling.service";
import { SellingAuthGuard } from "./selling-auth.guard";

@Controller("sell")
export class SellingController {
  constructor(private readonly sellingService: SellingService) {}

  @Post("listings")
  @UseGuards(SellingAuthGuard)
  @UseInterceptors(
    FilesInterceptor("photos", 8, {
      limits: {
        fileSize: 8 * 1024 * 1024,
        files: 8,
        fields: 1,
        fieldSize: 64 * 1024,
      },
    }),
  )
  async publish(
    @Headers("authorization") authorization: string | undefined,
    @Body("payload") payload: string,
    @UploadedFiles() photos: AvatarUpload[],
  ) {
    let value: unknown;
    try {
      value = JSON.parse(payload);
    } catch {
      throw new BadRequestException("Listing details must be valid JSON.");
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("Listing details are required.");
    }
    const dto = plainToInstance(PublishListingDto, value);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) {
      throw new BadRequestException(
        "Check the title, price, book details, and photo selections.",
      );
    }
    return this.sellingService.publish(
      authorization?.replace(/^Bearer\s+/i, "").trim() ?? "",
      dto,
      photos ?? [],
    );
  }
}
