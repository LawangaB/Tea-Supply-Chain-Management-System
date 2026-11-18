-- Business rules enforced by the database itself (defence in depth: the API checks them first and
-- returns friendlier field errors). Prisma does not model CHECK constraints or triggers, so they live here.
-- Constraint names follow "<table>_<column>_check": the API error handler maps them back to a field name.
-- Nothing here is schema-qualified, so the migration also applies to the per-test-file schemas.

-- Green-leaf weighing (rules/netWeight.js): net = gross - tare at gram precision, MAX_GROSS_KG = 10000.
ALTER TABLE "collection"
  ADD CONSTRAINT "collection_net_kg_check" CHECK ("net_kg" = round("gross_kg" - "tare_kg", 3)),
  ADD CONSTRAINT "collection_gross_kg_check" CHECK ("gross_kg" > 0 AND "gross_kg" <= 10000),
  ADD CONSTRAINT "collection_tare_kg_check" CHECK ("tare_kg" >= 0 AND "tare_kg" < "gross_kg"),
  ADD CONSTRAINT "collection_price_per_kg_check" CHECK ("price_per_kg" >= 0);

ALTER TABLE "green_leaf_batch"
  ADD CONSTRAINT "green_leaf_batch_net_kg_check" CHECK ("net_kg" >= 0),
  ADD CONSTRAINT "green_leaf_batch_accepted_kg_check" CHECK ("accepted_kg" IS NULL OR "accepted_kg" >= 0);

-- Fields: area > 0 (and the old schema maximum), GPS in range and either both set or neither.
ALTER TABLE "field"
  ADD CONSTRAINT "field_area_ha_check" CHECK ("area_ha" > 0 AND "area_ha" <= 10000),
  ADD CONSTRAINT "field_gps_check" CHECK (
    ("gps_lat" IS NULL AND "gps_lng" IS NULL)
    OR ("gps_lat" BETWEEN -90 AND 90 AND "gps_lng" BETWEEN -180 AND 180)
  );

-- Producers: an organisation member must belong to an organisation.
ALTER TABLE "producer"
  ADD CONSTRAINT "producer_org_id_check" CHECK ("type" <> 'ORG_MEMBER' OR "org_id" IS NOT NULL);

-- Users: at least one role.
ALTER TABLE "app_user"
  ADD CONSTRAINT "app_user_roles_check" CHECK (cardinality("roles") > 0);

-- Price versions.
ALTER TABLE "price_version"
  ADD CONSTRAINT "price_version_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "price_version_price_per_kg_check" CHECK ("price_per_kg" >= 0);

-- Audit log is append-only: refuse UPDATE and DELETE row by row.
-- (TRUNCATE, used only by the seed script to reset demo data, is a separate privilege and is not blocked.)
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Default SQLSTATE P0001 (raise_exception). Not restrict_violation: Prisma reports that as a foreign-key error.
  RAISE EXCEPTION 'audit_log is append-only: % is not allowed', TG_OP;
END;
$$;

CREATE TRIGGER "audit_log_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();
