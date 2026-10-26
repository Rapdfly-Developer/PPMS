ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "refractionByName" TEXT;

-- One-time fill for visits passed over before this column existed: the
-- refractionist recorded on the earliest PASS_OVER audit entry. Only the new,
-- still-empty column is written.
UPDATE "Visit" v
SET "refractionByName" = r."name"
FROM (
  SELECT DISTINCT ON (a."entityId") a."entityId", a."userId"
  FROM "AuditLog" a
  WHERE a."entityType" = 'Visit' AND a."action" = 'PASS_OVER'
  ORDER BY a."entityId", a."timestamp" ASC
) p
JOIN "Refractionist" r ON r."userId" = p."userId"
WHERE v."id" = p."entityId" AND v."refractionByName" IS NULL;
