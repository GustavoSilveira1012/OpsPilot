
BEGIN;

ALTER TABLE "incident_events"
ADD COLUMN "sequence" BIGINT;

CREATE SEQUENCE "incident_events_sequence_seq";

-- Preserve chronological order for existing records.
WITH ordered_events AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      ORDER BY occurred_at, created_at, id
    ) AS position
  FROM "incident_events"
)
UPDATE "incident_events" AS event
SET "sequence" = ordered_events.position
FROM ordered_events
WHERE event.id = ordered_events.id;

ALTER TABLE "incident_events"
ALTER COLUMN "sequence" SET NOT NULL;

ALTER TABLE "incident_events"
ALTER COLUMN "sequence"
SET DEFAULT nextval('incident_events_sequence_seq');

ALTER SEQUENCE "incident_events_sequence_seq"
OWNED BY "incident_events"."sequence";

SELECT setval(
  'incident_events_sequence_seq',
  COALESCE(
    (SELECT MAX(sequence) FROM "incident_events"),
    1
  ),
  EXISTS(SELECT 1 FROM "incident_events")
);

CREATE UNIQUE INDEX "incident_events_sequence_key"
ON "incident_events"("sequence");

CREATE INDEX
"incident_events_organization_id_incident_id_sequence_idx"
ON "incident_events"(
  "organization_id",
  "incident_id",
  "sequence"
);

COMMIT;
