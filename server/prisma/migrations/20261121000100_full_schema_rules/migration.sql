-- Business rules for the full schema, enforced by the database itself (defence in depth: the API checks
-- them first and returns friendlier field errors). Prisma does not model CHECK constraints or triggers,
-- so they live here. Same conventions as 20261118000100_db_rules:
--   * constraint names "<table>_<column>_check" (the API error handler maps them back to a field name);
--   * nothing is schema-qualified, so the migration also applies to the per-test-file schemas.
-- Rules that need other tables (e.g. "only RELEASED batches can be stocked in") are checked in the app
-- inside a transaction; see docs/DATABASE.md.

-- ----------------------------- Existing tables: new columns -----------------------------
ALTER TABLE "green_leaf_batch"
  ADD CONSTRAINT "green_leaf_batch_available_kg_check"
    CHECK ("available_kg" IS NULL OR ("available_kg" >= 0 AND ("accepted_kg" IS NULL OR "available_kg" <= "accepted_kg")));

ALTER TABLE "price_version"
  ADD CONSTRAINT "price_version_effective_to_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  ADD CONSTRAINT "price_version_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL),
  ADD CONSTRAINT "price_version_scope_check" CHECK (
    ("price_type" = 'PURCHASE_GL' AND "grade_id" IS NULL AND "product_id" IS NULL)
    OR "price_type" = 'SELLING_FT'
  );

-- US-022: a Green-Leaf Batch ID can never be changed once generated.
CREATE FUNCTION "green_leaf_batch_code_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."batch_code" IS DISTINCT FROM OLD."batch_code" THEN
    RAISE EXCEPTION 'green_leaf_batch.batch_code cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "green_leaf_batch_code_no_update"
  BEFORE UPDATE OF "batch_code" ON "green_leaf_batch"
  FOR EACH ROW EXECUTE FUNCTION "green_leaf_batch_code_immutable"();

-- ----------------------------- Master data -----------------------------
ALTER TABLE "tea_grade"
  ADD CONSTRAINT "tea_grade_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "tea_grade_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);

ALTER TABLE "inspection_parameter"
  ADD CONSTRAINT "inspection_parameter_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "inspection_parameter_allowed_check" CHECK ("allowed_min" IS NULL OR "allowed_max" IS NULL OR "allowed_min" <= "allowed_max"),
  ADD CONSTRAINT "inspection_parameter_standard_check" CHECK ("standard_min" IS NULL OR "standard_max" IS NULL OR "standard_min" <= "standard_max"),
  ADD CONSTRAINT "inspection_parameter_adjustment_check" CHECK ("adjustment_min" IS NULL OR "adjustment_max" IS NULL OR "adjustment_min" <= "adjustment_max"),
  ADD CONSTRAINT "inspection_parameter_deduction_pct_check" CHECK ("deduction_pct" IS NULL OR "deduction_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "inspection_parameter_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);

ALTER TABLE "tolerance"
  ADD CONSTRAINT "tolerance_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "tolerance_value_check" CHECK ("value" >= 0),
  ADD CONSTRAINT "tolerance_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);

-- ----------------------------- M2 / M3 -----------------------------
ALTER TABLE "harvest"
  ADD CONSTRAINT "harvest_estimated_kg_check" CHECK ("estimated_kg" > 0 AND "estimated_kg" <= 100000);

ALTER TABLE "collection_request"
  ADD CONSTRAINT "collection_request_estimated_kg_check" CHECK ("estimated_kg" IS NULL OR "estimated_kg" > 0),
  ADD CONSTRAINT "collection_request_scheduled_at_check" CHECK ("status" <> 'SCHEDULED' OR "scheduled_at" IS NOT NULL),
  ADD CONSTRAINT "collection_request_cancel_reason_check" CHECK ("status" <> 'CANCELLED' OR "cancel_reason" IS NOT NULL);

ALTER TABLE "factory_receipt"
  ADD CONSTRAINT "factory_receipt_received_kg_check" CHECK ("received_kg" >= 0 AND "received_kg" <= 10000),
  ADD CONSTRAINT "factory_receipt_review_status_check" CHECK ("is_flagged" OR "review_status" = 'NOT_REQUIRED');

-- ----------------------------- M4 / M6 quality -----------------------------
ALTER TABLE "quality_inspection"
  ADD CONSTRAINT "quality_inspection_subject_check" CHECK (
    ("subject" = 'GREEN_LEAF'   AND "green_leaf_batch_id" IS NOT NULL AND "finished_batch_id" IS NULL)
    OR ("subject" = 'FINISHED_TEA' AND "finished_batch_id" IS NOT NULL AND "green_leaf_batch_id" IS NULL)
  ),
  ADD CONSTRAINT "quality_inspection_decision_check" CHECK ("decision" IS NULL OR "subject" = 'GREEN_LEAF'),
  ADD CONSTRAINT "quality_inspection_adjusted_kg_check" CHECK (
    ("adjusted_kg" IS NULL OR "adjusted_kg" >= 0)
    AND ("decision" IS DISTINCT FROM 'ACCEPTED_WITH_ADJUSTMENT' OR "adjusted_kg" IS NOT NULL)
  ),
  ADD CONSTRAINT "quality_inspection_decision_reason_check" CHECK (
    "decision" IS NULL OR "decision" = 'ACCEPTED' OR "decision_reason" IS NOT NULL
  ),
  ADD CONSTRAINT "quality_inspection_deduction_pct_check" CHECK ("deduction_pct" IS NULL OR "deduction_pct" BETWEEN 0 AND 100);

-- ----------------------------- M5 processing -----------------------------
ALTER TABLE "processing_input"
  ADD CONSTRAINT "processing_input_allocated_kg_check" CHECK ("allocated_kg" > 0);

ALTER TABLE "processing_stage"
  ADD CONSTRAINT "processing_stage_sequence_check" CHECK ("sequence" >= 1),
  ADD CONSTRAINT "processing_stage_input_kg_check" CHECK ("input_kg" > 0),
  ADD CONSTRAINT "processing_stage_output_kg_check" CHECK ("output_kg" >= 0 AND "by_product_kg" >= 0 AND "loss_kg" >= 0),
  -- US-029: output + by-products + losses may not exceed the input.
  ADD CONSTRAINT "processing_stage_balance_check" CHECK ("output_kg" + "by_product_kg" + "loss_kg" <= "input_kg"),
  ADD CONSTRAINT "processing_stage_ended_at_check" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

ALTER TABLE "processing_reconciliation"
  ADD CONSTRAINT "processing_reconciliation_kg_check" CHECK ("input_kg" >= 0 AND "output_kg" >= 0 AND "by_product_kg" >= 0 AND "loss_kg" >= 0),
  ADD CONSTRAINT "processing_reconciliation_reason_check" CHECK ("status" <> 'PENDING_APPROVAL' OR "reason" IS NOT NULL),
  ADD CONSTRAINT "processing_reconciliation_decided_by_id_check" CHECK (
    "status" NOT IN ('APPROVED', 'REJECTED') OR ("decided_by_id" IS NOT NULL AND "decision_reason" IS NOT NULL)
  );

-- ----------------------------- M6 / M7 finished tea + traceability -----------------------------
ALTER TABLE "finished_tea_batch"
  ADD CONSTRAINT "finished_tea_batch_quantity_kg_check" CHECK ("quantity_kg" > 0),
  ADD CONSTRAINT "finished_tea_batch_input_kg_check" CHECK ("input_kg" IS NULL OR "input_kg" > 0),
  ADD CONSTRAINT "finished_tea_batch_yield_pct_check" CHECK ("yield_pct" IS NULL OR "yield_pct" BETWEEN 0 AND 100),
  ADD CONSTRAINT "finished_tea_batch_released_by_id_check" CHECK (
    "release_status" <> 'RELEASED' OR ("released_by_id" IS NOT NULL AND "released_at" IS NOT NULL)
  );

ALTER TABLE "finished_batch_source"
  ADD CONSTRAINT "finished_batch_source_quantity_kg_check" CHECK ("quantity_kg" IS NULL OR "quantity_kg" > 0);

ALTER TABLE "batch_release_event"
  ADD CONSTRAINT "batch_release_event_reason_check" CHECK ("action" = 'RELEASE' OR "reason" IS NOT NULL);

ALTER TABLE "qr_code"
  ADD CONSTRAINT "qr_code_print_count_check" CHECK ("print_count" >= 1);

ALTER TABLE "traceability_issue"
  ADD CONSTRAINT "traceability_issue_target_check" CHECK (
    "finished_batch_id" IS NOT NULL OR "processing_batch_id" IS NOT NULL OR "green_leaf_batch_id" IS NOT NULL
  );

-- ----------------------------- M8 warehouse -----------------------------
ALTER TABLE "storage_location"
  ADD CONSTRAINT "storage_location_capacity_kg_check" CHECK ("capacity_kg" IS NULL OR "capacity_kg" > 0);

-- US-042/043/053: stock can never go negative and reservations can never exceed what is on hand,
-- even when two requests run at the same time (the second UPDATE fails this CHECK).
ALTER TABLE "stock_balance"
  ADD CONSTRAINT "stock_balance_on_hand_kg_check" CHECK ("on_hand_kg" >= 0),
  ADD CONSTRAINT "stock_balance_reserved_kg_check" CHECK ("reserved_kg" >= 0 AND "reserved_kg" <= "on_hand_kg");

ALTER TABLE "stock_movement"
  ADD CONSTRAINT "stock_movement_quantity_kg_check" CHECK ("quantity_kg" > 0),
  ADD CONSTRAINT "stock_movement_location_check" CHECK (
    ("type" = 'STOCK_IN' AND "to_location_id" IS NOT NULL)
    OR ("type" = 'TRANSFER' AND "from_location_id" IS NOT NULL AND "to_location_id" IS NOT NULL
        AND "from_location_id" <> "to_location_id")
    OR ("type" IN ('ADJUSTMENT', 'RESERVE', 'RELEASE_RESERVATION', 'DISPATCH')
        AND ("from_location_id" IS NOT NULL OR "to_location_id" IS NOT NULL))
  ),
  ADD CONSTRAINT "stock_movement_order_id_check" CHECK ("type" NOT IN ('RESERVE', 'RELEASE_RESERVATION', 'DISPATCH') OR "order_id" IS NOT NULL),
  ADD CONSTRAINT "stock_movement_adjustment_id_check" CHECK ("type" <> 'ADJUSTMENT' OR "adjustment_id" IS NOT NULL);

ALTER TABLE "stock_adjustment"
  ADD CONSTRAINT "stock_adjustment_delta_kg_check" CHECK ("delta_kg" <> 0),
  ADD CONSTRAINT "stock_adjustment_decided_by_id_check" CHECK ("status" = 'PENDING' OR "decided_by_id" IS NOT NULL),
  ADD CONSTRAINT "stock_adjustment_decision_reason_check" CHECK ("status" <> 'REJECTED' OR "decision_reason" IS NOT NULL);

ALTER TABLE "stock_count_line"
  ADD CONSTRAINT "stock_count_line_system_kg_check" CHECK ("system_kg" >= 0),
  ADD CONSTRAINT "stock_count_line_counted_kg_check" CHECK ("counted_kg" >= 0),
  ADD CONSTRAINT "stock_count_line_difference_kg_check" CHECK ("difference_kg" = "counted_kg" - "system_kg");

ALTER TABLE "low_stock_threshold"
  ADD CONSTRAINT "low_stock_threshold_threshold_kg_check" CHECK ("threshold_kg" > 0),
  ADD CONSTRAINT "low_stock_threshold_decided_by_id_check" CHECK ("status" = 'PENDING' OR "decided_by_id" IS NOT NULL);

-- ----------------------------- M9 orders + invoices -----------------------------
ALTER TABLE "sales_order"
  ADD CONSTRAINT "sales_order_subtotal_check" CHECK ("subtotal" >= 0),
  ADD CONSTRAINT "sales_order_version_check" CHECK ("version" >= 0),
  ADD CONSTRAINT "sales_order_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL),
  ADD CONSTRAINT "sales_order_cancel_reason_check" CHECK ("status" <> 'CANCELLED' OR "cancel_reason" IS NOT NULL);

ALTER TABLE "order_line"
  ADD CONSTRAINT "order_line_quantity_kg_check" CHECK ("quantity_kg" > 0),
  ADD CONSTRAINT "order_line_unit_price_check" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "order_line_line_total_check" CHECK ("line_total" = round("quantity_kg" * "unit_price", 2));

ALTER TABLE "order_allocation"
  ADD CONSTRAINT "order_allocation_quantity_kg_check" CHECK ("quantity_kg" > 0);

ALTER TABLE "invoice"
  ADD CONSTRAINT "invoice_amounts_check" CHECK ("subtotal" >= 0 AND "tax_amount" >= 0),
  ADD CONSTRAINT "invoice_total_check" CHECK ("total" = "subtotal" + "tax_amount");

ALTER TABLE "invoice_payment"
  ADD CONSTRAINT "invoice_payment_amount_check" CHECK ("amount" > 0);

-- ----------------------------- M11 farmer payments -----------------------------
ALTER TABLE "payment_adjustment_rule"
  ADD CONSTRAINT "payment_adjustment_rule_version_check" CHECK ("version" >= 1),
  ADD CONSTRAINT "payment_adjustment_rule_value_check" CHECK ("value" >= 0),
  ADD CONSTRAINT "payment_adjustment_rule_condition_check" CHECK (
    ("condition" <> 'QUALITY_DECISION' OR "decision" IS NOT NULL)
    AND ("condition" <> 'GRADE' OR "grade_id" IS NOT NULL)
    AND ("condition" <> 'MIN_PERIOD_KG' OR "min_period_kg" IS NOT NULL)
  ),
  ADD CONSTRAINT "payment_adjustment_rule_basis_check" CHECK ("basis" <> 'PERCENT' OR "value" <= 100);

ALTER TABLE "farmer_payment"
  ADD CONSTRAINT "farmer_payment_period_check" CHECK ("period_end" >= "period_start"),
  ADD CONSTRAINT "farmer_payment_total_net_kg_check" CHECK ("total_net_kg" >= 0),
  ADD CONSTRAINT "farmer_payment_base_amount_check" CHECK ("base_amount" >= 0),
  ADD CONSTRAINT "farmer_payment_total_amount_check" CHECK ("total_amount" >= 0 AND "total_amount" = "base_amount" + "adjustments_total"),
  ADD CONSTRAINT "farmer_payment_approved_by_id_check" CHECK ("status" NOT IN ('APPROVED', 'PAID') OR ("approved_by_id" IS NOT NULL AND "approved_at" IS NOT NULL)),
  ADD CONSTRAINT "farmer_payment_payment_reference_check" CHECK ("status" <> 'PAID' OR ("paid_at" IS NOT NULL AND "payment_reference" IS NOT NULL)),
  ADD CONSTRAINT "farmer_payment_rejection_reason_check" CHECK ("status" <> 'REJECTED' OR "rejection_reason" IS NOT NULL);
-- Segregation of duties (US-062: approver <> preparer) is "to confirm with client", so it is an app rule for now.

ALTER TABLE "farmer_payment_line"
  ADD CONSTRAINT "farmer_payment_line_net_kg_check" CHECK ("net_kg" >= 0),
  ADD CONSTRAINT "farmer_payment_line_price_per_kg_check" CHECK ("price_per_kg" >= 0),
  ADD CONSTRAINT "farmer_payment_line_amount_check" CHECK ("amount" >= 0);

-- ----------------------------- M12 transport -----------------------------
ALTER TABLE "vehicle"
  ADD CONSTRAINT "vehicle_capacity_kg_check" CHECK ("capacity_kg" IS NULL OR "capacity_kg" > 0);

ALTER TABLE "transport_job"
  ADD CONSTRAINT "transport_job_order_id_check" CHECK (("type" = 'DELIVERY') = ("order_id" IS NOT NULL)),
  ADD CONSTRAINT "transport_job_failure_reason_check" CHECK ("status" NOT IN ('FAILED', 'DELAYED') OR "failure_reason" IS NOT NULL);

ALTER TABLE "transport_job_event"
  ADD CONSTRAINT "transport_job_event_gps_check" CHECK (
    ("gps_lat" IS NULL AND "gps_lng" IS NULL)
    OR ("gps_lat" BETWEEN -90 AND 90 AND "gps_lng" BETWEEN -180 AND 180)
  );

ALTER TABLE "proof_of_delivery"
  ADD CONSTRAINT "proof_of_delivery_evidence_check" CHECK ("signature_url" IS NOT NULL OR "photo_url" IS NOT NULL);

-- ----------------------------- M13 notifications -----------------------------
ALTER TABLE "alert_rule"
  ADD CONSTRAINT "alert_rule_recipient_roles_check" CHECK (cardinality("recipient_roles") > 0);

ALTER TABLE "low_stock_threshold"
  ADD CONSTRAINT "low_stock_threshold_notify_roles_check" CHECK (cardinality("notify_roles") > 0);

-- ----------------------------- Append-only history tables -----------------------------
-- Same idea as audit_log: history rows can be added but never changed or removed.
-- (TRUNCATE, used only by the seed script to reset demo data, is not blocked.)
CREATE FUNCTION "append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Default SQLSTATE P0001 (raise_exception), like audit_log_append_only.
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER "stock_movement_no_update_delete"
  BEFORE UPDATE OR DELETE ON "stock_movement"
  FOR EACH ROW EXECUTE FUNCTION "append_only"();

CREATE TRIGGER "batch_release_event_no_update_delete"
  BEFORE UPDATE OR DELETE ON "batch_release_event"
  FOR EACH ROW EXECUTE FUNCTION "append_only"();

CREATE TRIGGER "order_status_history_no_update_delete"
  BEFORE UPDATE OR DELETE ON "order_status_history"
  FOR EACH ROW EXECUTE FUNCTION "append_only"();

CREATE TRIGGER "transport_job_event_no_update_delete"
  BEFORE UPDATE OR DELETE ON "transport_job_event"
  FOR EACH ROW EXECUTE FUNCTION "append_only"();
