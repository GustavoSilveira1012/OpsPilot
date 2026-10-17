import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthIdentity } from './auth.types.js';

export const PUBLIC_ROUTE = 'opspilot:public';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthIdentity =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().identity,
);
