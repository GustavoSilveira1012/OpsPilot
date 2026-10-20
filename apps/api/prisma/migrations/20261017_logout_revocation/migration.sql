BEGIN;

CREATE TABLE "revoked_sessions" (
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "revoked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "revoked_sessions_pkey" PRIMARY KEY ("session_id")
);

CREATE INDEX "revoked_sessions_user_id_idx" ON "revoked_sessions"("user_id");
ALTER TABLE "revoked_sessions" ENABLE ROW LEVEL SECURITY;

COMMIT;
