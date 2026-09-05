import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";

import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { UpdateBioDto } from "./dto/update-bio.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserAddress } from "./entities/user-address.entity";
import {
  UsersService,
  type CreatedUserSession,
  type PublicAccount,
} from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<CreatedUserSession> {
    return this.usersService.create(createUserDto);
  }

  @Post("login")
  login(@Body() loginUserDto: LoginUserDto): Promise<CreatedUserSession> {
    return this.usersService.login(loginUserDto);
  }

  @Get("me")
  getAccount(
    @Headers("authorization") authorization?: string,
  ): Promise<PublicAccount> {
    return this.usersService.getAccount(this.getBearerToken(authorization));
  }

  @Patch("me")
  updateAccount(
    @Headers("authorization") authorization: string | undefined,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<PublicAccount> {
    return this.usersService.updateAccount(
      this.getBearerToken(authorization),
      updateUserDto,
    );
  }

  @Patch("me/bio")
  updateBio(
    @Headers("authorization") authorization: string | undefined,
    @Body() updateBioDto: UpdateBioDto,
  ): Promise<PublicAccount> {
    return this.usersService.updateBio(
      this.getBearerToken(authorization),
      updateBioDto,
    );
  }

  @Post("me/addresses")
  addAddress(
    @Headers("authorization") authorization: string | undefined,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<UserAddress> {
    return this.usersService.addAddress(
      this.getBearerToken(authorization),
      createAddressDto,
    );
  }

  @Patch("me/addresses/:addressId")
  updateAddress(
    @Headers("authorization") authorization: string | undefined,
    @Param("addressId") addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<UserAddress> {
    return this.usersService.updateAddress(
      this.getBearerToken(authorization),
      addressId,
      updateAddressDto,
    );
  }

  @Delete("me/addresses/:addressId")
  @HttpCode(204)
  deleteAddress(
    @Headers("authorization") authorization: string | undefined,
    @Param("addressId") addressId: string,
  ): Promise<void> {
    return this.usersService.deleteAddress(
      this.getBearerToken(authorization),
      addressId,
    );
  }

  @Delete("me/session")
  @HttpCode(204)
  logout(@Headers("authorization") authorization?: string): Promise<void> {
    return this.usersService.logout(this.getBearerToken(authorization));
  }

  @Delete("me")
  @HttpCode(204)
  deleteAccount(
    @Headers("authorization") authorization?: string,
  ): Promise<void> {
    return this.usersService.deleteAccount(this.getBearerToken(authorization));
  }

  private getBearerToken(authorization?: string): string {
    return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  }
}
