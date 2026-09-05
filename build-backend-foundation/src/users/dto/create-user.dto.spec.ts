import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateUserDto } from "./create-user.dto";

const validUser = {
  fullName: "Mika Reader",
  mailingAddressLine1: "123 Manga Lane",
  mailingAddressLine2: "Apartment 4B",
  region: "US",
  username: "mikashelf",
  email: "mika@example.com",
  password: "Volume#123",
};

describe("CreateUserDto", () => {
  it("rejects an email address as a username", async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validUser,
      username: "mika@example.com",
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === "username")).toBe(true);
  });

  it("normalizes and accepts a lowercase ISO country code", async () => {
    const dto = plainToInstance(CreateUserDto, {
      ...validUser,
      region: "us",
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.region).toBe("US");
  });
});
