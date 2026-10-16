export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'opspilot-api';
  readonly version: string;
  readonly timestamp: string;
}
