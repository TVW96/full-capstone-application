import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";

import { AppModule } from "../../app.module";
import { getSeedSummary, persistSeeds } from "./seed-data";

const logger = new Logger("DatabaseSeed");

async function seedDatabase(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = application.get(DataSource);
    await dataSource.transaction(persistSeeds);

    logger.log(`Seeded ${getSeedSummary()}.`);
  } finally {
    await application.close();
  }
}

void seedDatabase().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);

  logger.error("Database seeding failed.", details);
  process.exitCode = 1;
});
