-- Add monotonic ordering for existing and future audit events.
-- Keep existing event rows and preserve their best-known historical order.
ALTER TABLE "incident_events" ADD COLUMN "sequence" BIGINT;
CREATE SEQUENCE "incident_events_sequence_seq";
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "occurred_at", "created_at", id) AS ordinal
  FROM "incident_events"
)
UPDATE "incident_events" AS evt SET "sequence" = ordered.ordinal
FROM ordered WHERE evt.id = ordered.id;
ALTER TABLE "incident_events" ALTER COLUMN "sequence" SET NOT NULL;
ALTER TABLE "incident_events" ALTER COLUMN "sequence"
  SET DEFAULT nextval('incident_events_sequence_seq');
ALTER SEQUENCE "incident_events_sequence_seq" OWNED BY "incident_events"."sequence";
SELECT setval(
  'incident_events_sequence_seq',
  GREATEST(COALESCE((SELECT MAX("sequence") FROM "incident_events"), 0), 1),
  EXISTS (SELECT 1 FROM "incident_events")
);
CREATE UNIQUE INDEX "incident_events_sequence_key" ON "incident_events"("sequence");
CREATE INDEX "incident_events_organization_id_incident_id_sequence_idx"
  ON "incident_events"("organization_id", "incident_id", "sequence");
