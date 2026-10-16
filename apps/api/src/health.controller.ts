import { Controller, Get, Header } from '@nestjs/common';
import type { HealthResponse } from '@opspilot/contracts';

@Controller()
export class HealthController {
  @Get('health')
  @Header('Cache-Control', 'no-store')
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'opspilot-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
