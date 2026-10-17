-- Application data is available only through the NestJS API. No browser Data API policies.
-- The Prisma connection must use the table owner or an appropriately privileged server role.
BEGIN;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_ownerships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_responders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_events" ENABLE ROW LEVEL SECURITY;
COMMIT;
