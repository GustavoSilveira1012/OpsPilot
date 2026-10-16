import 'reflect-metadata';
import 'dotenv/config';
import helmet from 'helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

function getPort(): number {
  const port = Number(process.env.PORT ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function getCorsOrigins(): string[] {
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one allowed origin.');
  }

  for (const origin of origins) {
    const parsedOrigin = new URL(origin);

    if (parsedOrigin.origin !== origin || !['http:', 'https:'].includes(parsedOrigin.protocol)) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }

  return origins;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  const port = getPort();

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: getCorsOrigins(),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });
  app.use(helmet());
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`OpsPilot API is listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);
  new Logger('Bootstrap').error(`OpsPilot API failed to start: ${details}`);
  process.exitCode = 1;
});
