import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Repository } from "typeorm";

import { CreateUserDto } from "./dto/create-user.dto";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";
import { LoginUserDto } from "./dto/login-user.dto";
import { UpdateBioDto } from "./dto/update-bio.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserAddress } from "./entities/user-address.entity";
import { UserSession } from "./entities/user-session.entity";
import { User } from "./entities/user.entity";

const scrypt = promisify(nodeScrypt);
const PASSWORD_KEY_LENGTH = 64;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export type PublicUser = Pick<
  User,
  "userId" | "email" | "username" | "fullName" | "region" | "createdAt"
>;

export type CreatedUserSession = {
  user: PublicUser;
  session: {
    token: string;
    expiresAt: Date;
  };
};

export type PublicAccount = PublicUser &
  Pick<User, "avatarUrl" | "bio" | "updatedAt"> & {
    addresses: UserAddress[];
  };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<CreatedUserSession> {
    const email = createUserDto.email.trim().toLowerCase();
    const username = createUserDto.username.trim().toLowerCase();
    const fullName = createUserDto.fullName.trim();
    const mailingAddressLine1 = createUserDto.mailingAddressLine1.trim();
    const mailingAddressLine2 =
      createUserDto.mailingAddressLine2?.trim() || null;
    const region = createUserDto.region.trim().toUpperCase();

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser?.email === email) {
      throw new ConflictException({
        message: "An account with this email already exists.",
        field: "email",
      });
    }

    if (existingUser?.username === username) {
      throw new ConflictException({
        message: "This username is already taken.",
        field: "username",
      });
    }

    const passwordHash = await this.hashPassword(createUserDto.password);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    try {
      return await this.usersRepository.manager.transaction(
        async (manager): Promise<CreatedUserSession> => {
          const transactionUsers = manager.getRepository(User);
          const transactionSessions = manager.getRepository(UserSession);
          const transactionAddresses = manager.getRepository(UserAddress);
          const user = transactionUsers.create({
            email,
            username,
            fullName,
            mailingAddressLine1,
            mailingAddressLine2,
            region,
            passwordHash,
            avatarUrl: null,
            bio: null,
          });
          const savedUser = await transactionUsers.save(user);
          const primaryAddress = transactionAddresses.create({
            userId: savedUser.userId,
            label: "Primary",
            addressLine1: mailingAddressLine1,
            addressLine2: mailingAddressLine2,
            city: "",
            administrativeArea: null,
            postalCode: "",
            country: region,
            isDefault: true,
          });
          const session = transactionSessions.create({
            userId: savedUser.userId,
            tokenHash: createHash("sha256").update(token).digest("hex"),
            expiresAt,
          });

          await Promise.all([
            transactionAddresses.save(primaryAddress),
            transactionSessions.save(session),
          ]);

          return {
            user: {
              userId: savedUser.userId,
              email: savedUser.email,
              username: savedUser.username,
              fullName: savedUser.fullName,
              region: savedUser.region,
              createdAt: savedUser.createdAt,
            },
            session: {
              token,
              expiresAt,
            },
          };
        },
      );
    } catch (error: unknown) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          message: "An account with this email or username already exists.",
          field: "email",
        });
      }

      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<CreatedUserSession> {
    const email = loginUserDto.email.trim().toLowerCase();
    const user = await this.usersRepository.findOne({
      where: { email },
      select: {
        userId: true,
        email: true,
        username: true,
        fullName: true,
        region: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    if (
      !user?.passwordHash ||
      !(await this.verifyPassword(loginUserDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Email or password is incorrect.");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const session = this.usersRepository.manager
      .getRepository(UserSession)
      .create({
        userId: user.userId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt,
      });

    await this.usersRepository.manager.getRepository(UserSession).save(session);

    return {
      user: {
        userId: user.userId,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        region: user.region,
        createdAt: user.createdAt,
      },
      session: { token, expiresAt },
    };
  }

  async getAccount(token: string): Promise<PublicAccount> {
    const user = await this.requireAuthenticatedUser(token);

    return this.toPublicAccount(user);
  }

  async updateAccount(
    token: string,
    updateUserDto: UpdateUserDto,
  ): Promise<PublicAccount> {
    const user = await this.requireAuthenticatedUser(token);

    if (updateUserDto.fullName !== undefined) {
      user.fullName = updateUserDto.fullName.trim();
    }
    if (updateUserDto.username !== undefined) {
      user.username = updateUserDto.username.trim().toLowerCase();
    }
    if (updateUserDto.region !== undefined) {
      user.region = updateUserDto.region.trim().toUpperCase();
    }
    try {
      await this.usersRepository.save(user);
    } catch (error: unknown) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException({
          field: "username",
          message: "This username is already taken.",
        });
      }
      throw error;
    }

    return this.toPublicAccount(user);
  }

  async updateBio(
    token: string,
    updateBioDto: UpdateBioDto,
  ): Promise<PublicAccount> {
    const user = await this.requireAuthenticatedUser(token);
    user.bio = updateBioDto.bio.trim() || null;
    await this.usersRepository.save(user);

    return this.toPublicAccount(user);
  }

  async addAddress(
    token: string,
    createAddressDto: CreateAddressDto,
  ): Promise<UserAddress> {
    const user = await this.requireAuthenticatedUser(token);
    const addressesRepository =
      this.usersRepository.manager.getRepository(UserAddress);
    const isFirstAddress = user.addresses.length === 0;

    if (createAddressDto.isDefault) {
      await addressesRepository.update(
        { userId: user.userId },
        { isDefault: false },
      );
    }

    const address = addressesRepository.create({
      ...this.normalizeAddress(createAddressDto),
      userId: user.userId,
      isDefault: isFirstAddress || Boolean(createAddressDto.isDefault),
    });

    return addressesRepository.save(address);
  }

  async updateAddress(
    token: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<UserAddress> {
    const user = await this.requireAuthenticatedUser(token);
    const addressesRepository =
      this.usersRepository.manager.getRepository(UserAddress);
    const address = user.addresses.find((item) => item.addressId === addressId);

    if (!address) {
      throw new UnauthorizedException("Address not found.");
    }

    if (updateAddressDto.isDefault) {
      await addressesRepository.update(
        { userId: user.userId },
        { isDefault: false },
      );
    }

    Object.assign(address, this.normalizeAddress(updateAddressDto), {
      isDefault: address.isDefault || Boolean(updateAddressDto.isDefault),
    });

    return addressesRepository.save(address);
  }

  async deleteAddress(token: string, addressId: string): Promise<void> {
    const user = await this.requireAuthenticatedUser(token);
    const addressesRepository =
      this.usersRepository.manager.getRepository(UserAddress);
    const address = user.addresses.find((item) => item.addressId === addressId);

    if (!address) {
      throw new UnauthorizedException("Address not found.");
    }

    await addressesRepository.remove(address);

    if (address.isDefault) {
      const replacement = user.addresses.find(
        (item) => item.addressId !== address.addressId,
      );
      if (replacement) {
        replacement.isDefault = true;
        await addressesRepository.save(replacement);
      }
    }
  }

  async deleteAccount(token: string): Promise<void> {
    const user = await this.requireAuthenticatedUser(token);
    await this.usersRepository.manager.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM "listing_items"
         WHERE "listing_id" IN (
           SELECT "listing_id" FROM "listings" WHERE "seller_id" = $1
         ) OR "item_id" IN (
           SELECT "item_id" FROM "inventory_items" WHERE "owner_id" = $1
         )`,
        [user.userId],
      );
      await manager.query(`DELETE FROM "listings" WHERE "seller_id" = $1`, [
        user.userId,
      ]);
      await manager.query(
        `DELETE FROM "inventory_items" WHERE "owner_id" = $1`,
        [user.userId],
      );
      await manager.getRepository(User).remove(user);
    });
  }

  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.usersRepository.manager
      .getRepository(UserSession)
      .delete({ tokenHash });
  }

  async requireAuthenticatedUser(token: string): Promise<User> {
    if (!token) {
      throw new UnauthorizedException("Sign in to continue.");
    }

    const tokenHash = this.hashToken(token);
    const session = await this.usersRepository.manager
      .getRepository(UserSession)
      .findOne({
        where: { tokenHash },
        relations: { user: { addresses: true } },
      });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Your session has expired.");
    }

    return session.user;
  }

  private toPublicAccount(user: User): PublicAccount {
    return {
      userId: user.userId,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      region: user.region,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      addresses: [...(user.addresses ?? [])].sort(
        (left, right) => Number(right.isDefault) - Number(left.isDefault),
      ),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizeAddress(
    address: CreateAddressDto,
  ): Omit<
    UserAddress,
    "addressId" | "userId" | "user" | "isDefault" | "createdAt" | "updatedAt"
  > {
    return {
      label: address.label.trim(),
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2?.trim() || null,
      city: address.city.trim(),
      administrativeArea: address.administrativeArea?.trim() || null,
      postalCode: address.postalCode.trim(),
      country: address.country.trim().toUpperCase(),
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
    )) as Buffer;

    return `scrypt$${salt}$${derivedKey.toString("hex")}`;
  }

  private async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    const [algorithm, salt, storedKey] = passwordHash.split("$");

    if (algorithm !== "scrypt" || !salt || !storedKey) {
      return false;
    }

    const derivedKey = (await scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
    )) as Buffer;
    const storedKeyBuffer = Buffer.from(storedKey, "hex");

    return (
      storedKeyBuffer.length === derivedKey.length &&
      timingSafeEqual(storedKeyBuffer, derivedKey)
    );
  }

  private isUniqueConstraintViolation(
    error: unknown,
  ): error is { code: string } {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    );
  }
}
