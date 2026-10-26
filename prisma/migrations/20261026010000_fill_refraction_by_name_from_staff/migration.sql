-- Refractionists added from Settings / Users are HospitalStaff, not Refractionist,
-- so the first fill (20261026000000) missed them. Fill the still-empty
-- "refractionByName" from the staff record of the earliest PASS_OVER audit entry.
-- Only the empty refractionByName column is written.
UPDATE "Visit" v
SET "refractionByName" = s."name"
FROM (
  SELECT DISTINCT ON (a."entityId") a."entityId", a."userId"
  FROM "AuditLog" a
  WHERE a."entityType" = 'Visit' AND a."action" = 'PASS_OVER'
  ORDER BY a."entityId", a."timestamp" ASC
) p
JOIN "HospitalStaff" s ON s."userId" = p."userId"
WHERE v."id" = p."entityId" AND v."refractionByName" IS NULL;
