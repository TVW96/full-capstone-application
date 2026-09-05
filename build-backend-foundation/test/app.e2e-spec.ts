import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";

describe("AppModule (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_TARGET = "local";
    process.env.DB_HOST ??= "localhost";
    process.env.DB_PORT ??= "5432";
    process.env.DB_USERNAME ??= "test";
    process.env.DB_PASSWORD ??= "test";
    process.env.DB_NAME ??= "test";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("responds to unknown routes with 404", () => {
    return request(app.getHttpServer()).get("/does-not-exist").expect(404);
  });
});
