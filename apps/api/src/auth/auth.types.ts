export interface AuthIdentity {
  readonly id: string;
  readonly sessionId: string;
  readonly email: string | null;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  identity: AuthIdentity;
}
