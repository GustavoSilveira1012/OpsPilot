import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

function getPort(): number {
  const port = Number(process.env.PORT ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const port = getPort();

  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`OpsPilot API is listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);
  new Logger('Bootstrap').error(`OpsPilot API failed to start: ${details}`);
  process.exitCode = 1;
});
