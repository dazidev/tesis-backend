-- CreateIndex
CREATE INDEX "process_substages_stageId_status_idx" ON "process_substages"("stageId", "status");
UPDATE "process_stages" AS stage
SET "openSubstages" = (
  SELECT COUNT(*)::INTEGER
  FROM "process_substages" AS substage
  WHERE
    substage."stageId" = stage."id"
    AND substage."status" = 'opened'
);