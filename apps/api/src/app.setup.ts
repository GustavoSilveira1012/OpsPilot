import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';

export function configureApp(app: INestApplication): void {
  app.use(
    (
      _request: unknown,
      response: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader('Cache-Control', 'private, no-store');
      next();
    },
  );
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) throw new Error('CORS_ORIGINS must contain at least one origin.');
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`CORS_ORIGINS contains an invalid origin: ${origin}`);
    }
  }
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: origins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
}
