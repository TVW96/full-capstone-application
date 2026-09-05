import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { UsersModule } from "../users/users.module";
import { SellingController } from "./selling.controller";
import { SellingService } from "./selling.service";
import { SellingAuthGuard } from "./selling-auth.guard";

@Module({
  imports: [UsersModule, MediaModule],
  controllers: [SellingController],
  providers: [SellingService, SellingAuthGuard],
})
export class SellingModule {}
