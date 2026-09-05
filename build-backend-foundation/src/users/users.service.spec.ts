import { ConflictException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { createHash, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";

import { UserSession } from "./entities/user-session.entity";
import { UserAddress } from "./entities/user-address.entity";
import { User } from "./entities/user.entity";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  const scrypt = promisify(nodeScrypt);
  const createdAt = new Date("2026-08-29T12:00:00.000Z");
  const transactionUsers = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      ...value,
      userId: "10000000-0000-4000-8000-000000000010",
      createdAt,
    })),
  };
  const transactionSessions = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const transactionAddresses = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const transactionManager = {
    getRepository: jest.fn((entity) => {
      if (entity === User) return transactionUsers;
      if (entity === UserAddress) return transactionAddresses;
      return transactionSessions;
    }),
  };
  const usersRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
    remove: jest.fn(),
    manager: {
      getRepository: transactionManager.getRepository,
      transaction: jest.fn(async (work) => work(transactionManager)),
    },
  };

  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    usersRepository.findOne.mockResolvedValue(null);
    transactionSessions.findOne.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("saves a hashed password and a hashed session token", async () => {
    const result = await service.create({
      fullName: "Mika Reader",
      mailingAddressLine1: "123 Manga Lane",
      mailingAddressLine2: "Apartment 4B",
      region: "us",
      username: "MikaShelf",
      email: "MIKA@example.com",
      password: "Volume#123",
    });

    const savedUser = transactionUsers.save.mock.calls[0][0];
    const savedSession = transactionSessions.save.mock.calls[0][0];
    const savedAddress = transactionAddresses.save.mock.calls[0][0];

    expect(savedUser.email).toBe("mika@example.com");
    expect(savedUser.username).toBe("mikashelf");
    expect(savedUser.fullName).toBe("Mika Reader");
    expect(savedUser.mailingAddressLine1).toBe("123 Manga Lane");
    expect(savedUser.mailingAddressLine2).toBe("Apartment 4B");
    expect(savedUser.region).toBe("US");
    expect(savedUser.passwordHash).toMatch(
      /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/,
    );
    expect(savedUser.passwordHash).not.toContain("Volume#123");
    expect(savedSession.tokenHash).toBe(
      createHash("sha256").update(result.session.token).digest("hex"),
    );
    expect(savedAddress).toEqual(
      expect.objectContaining({
        label: "Primary",
        addressLine1: "123 Manga Lane",
        country: "US",
        isDefault: true,
      }),
    );
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(result.session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects an email that is already registered", async () => {
    usersRepository.findOne.mockResolvedValue({
      email: "mika@example.com",
      username: "another_user",
    });

    await expect(
      service.create({
        fullName: "Mika Reader",
        mailingAddressLine1: "123 Manga Lane",
        mailingAddressLine2: "",
        region: "US",
        username: "mikashelf",
        email: "mika@example.com",
        password: "Volume#123",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersRepository.manager.transaction).not.toHaveBeenCalled();
  });

  it("creates a session when valid credentials are supplied", async () => {
    const salt = "0123456789abcdef0123456789abcdef";
    const key = (await scrypt("Volume#123", salt, 64)) as Buffer;
    usersRepository.findOne.mockResolvedValue({
      userId: "10000000-0000-4000-8000-000000000010",
      email: "mika@example.com",
      username: "mikashelf",
      fullName: "Mika Reader",
      region: "US",
      createdAt,
      passwordHash: `scrypt$${salt}$${key.toString("hex")}`,
    });

    const result = await service.login({
      email: " MIKA@example.com ",
      password: "Volume#123",
    });

    expect(usersRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "mika@example.com" } }),
    );
    expect(transactionSessions.save).toHaveBeenCalled();
    expect(result.user.email).toBe("mika@example.com");
    expect(result).not.toHaveProperty("user.passwordHash");
  });

  it("rejects invalid credentials", async () => {
    usersRepository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: "missing@example.com", password: "not-it" }),
    ).rejects.toThrow("Email or password is incorrect.");

    expect(transactionSessions.save).not.toHaveBeenCalled();
  });

  it("returns the account attached to a valid session token", async () => {
    const updatedAt = new Date("2026-08-30T12:00:00.000Z");
    transactionSessions.findOne.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        userId: "10000000-0000-4000-8000-000000000010",
        email: "mika@example.com",
        username: "mikashelf",
        fullName: "Mika Reader",
        region: "US",
        avatarUrl: null,
        bio: "Deluxe edition collector.",
        addresses: [],
        createdAt,
        updatedAt,
        passwordHash: "must-not-leak",
      },
    });

    const account = await service.getAccount("plain-session-token");

    expect(transactionSessions.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tokenHash: createHash("sha256")
            .update("plain-session-token")
            .digest("hex"),
        },
      }),
    );
    expect(account.fullName).toBe("Mika Reader");
    expect(account).not.toHaveProperty("passwordHash");
  });

  it("updates a signed-in user's bio", async () => {
    const user = {
      userId: "10000000-0000-4000-8000-000000000010",
      email: "mika@example.com",
      username: "mikashelf",
      fullName: "Mika Reader",
      region: "US",
      avatarUrl: null,
      bio: null,
      addresses: [],
      createdAt,
      updatedAt: createdAt,
    };
    transactionSessions.findOne.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });

    const account = await service.updateBio("plain-session-token", {
      bio: "  Hunting for vintage first printings.  ",
    });

    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bio: "Hunting for vintage first printings.",
      }),
    );
    expect(account.bio).toBe("Hunting for vintage first printings.");
  });
});
