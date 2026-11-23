-- Full schema for all sprints (US-001 ... US-074). Generated from prisma/schema.prisma; only adds
-- enums, tables, nullable/defaulted columns, indexes and foreign keys, so existing data is untouched.

-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('ALL', 'OWN', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'ACTIVE', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SettingCategory" AS ENUM ('SECURITY', 'TECHNICAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('BUSINESS', 'SECURITY', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "BackupKind" AS ENUM ('BACKUP', 'RESTORE');

-- CreateEnum
CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CollectionRequestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COLLECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InspectionSubject" AS ENUM ('GREEN_LEAF', 'FINISHED_TEA');

-- CreateEnum
CREATE TYPE "LeafDecision" AS ENUM ('ACCEPTED', 'ACCEPTED_WITH_ADJUSTMENT', 'REJECTED');

-- CreateEnum
CREATE TYPE "ToleranceType" AS ENUM ('RECEIPT_WEIGHT', 'PROCESSING_VARIANCE', 'STOCK_COUNT');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('OPEN', 'COMPLETED', 'RECONCILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessingStageType" AS ENUM ('WITHERING', 'ROLLING', 'OXIDATION', 'DRYING', 'SORTING', 'GRADING', 'PACKING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('AUTO_ACCEPTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('NOT_RELEASED', 'RELEASED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ReleaseAction" AS ENUM ('RELEASE', 'HOLD', 'REVOKE');

-- CreateEnum
CREATE TYPE "TraceIssueType" AS ENUM ('MISSING_PROCESSING_SOURCE', 'MISSING_LEAF_INPUT', 'MISSING_COLLECTION_LINK');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('STOCK_IN', 'TRANSFER', 'ADJUSTMENT', 'RESERVE', 'RELEASE_RESERVATION', 'DISPATCH');

-- CreateEnum
CREATE TYPE "AdjustmentReason" AS ENUM ('DAMAGED', 'DOWNGRADED', 'COUNT_DIFFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "BuyerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'RESERVED', 'PACKED', 'DISPATCHED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('RESERVED', 'RELEASED', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "AdjustmentRuleType" AS ENUM ('BONUS', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "AdjustmentBasis" AS ENUM ('PER_KG', 'PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "AdjustmentCondition" AS ENUM ('ALWAYS', 'QUALITY_DECISION', 'GRADE', 'MIN_PERIOD_KG');

-- CreateEnum
CREATE TYPE "FarmerPaymentStatus" AS ENUM ('PREPARED', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "TransportJobType" AS ENUM ('COLLECTION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "TransportJobStatus" AS ENUM ('ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'DELAYED', 'FAILED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "PriceStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "app_user" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_changed_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "category" "AuditCategory" NOT NULL DEFAULT 'BUSINESS';

-- AlterTable
ALTER TABLE "collection" ADD COLUMN     "request_id" UUID;

-- AlterTable
ALTER TABLE "green_leaf_batch" ADD COLUMN     "available_kg" DECIMAL(10,3);

-- AlterTable
ALTER TABLE "price_version" ADD COLUMN     "effective_to" TIMESTAMPTZ(3),
ADD COLUMN     "grade_id" UUID,
ADD COLUMN     "product_id" UUID,
ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "rejection_reason" VARCHAR(300);

-- CreateTable
CREATE TABLE "permission" (
    "code" VARCHAR(60) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "description" VARCHAR(200),
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role" "Role" NOT NULL,
    "permission_code" VARCHAR(60) NOT NULL,
    "scope" "PermissionScope" NOT NULL DEFAULT 'ALL',
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role", "permission_code")
);

-- CreateTable
CREATE TABLE "user_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" VARCHAR(80) NOT NULL,
    "category" "SettingCategory" NOT NULL,
    "value" JSONB NOT NULL,
    "description" VARCHAR(300),
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "system_log" (
    "id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "request_id" VARCHAR(64),
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_run" (
    "id" UUID NOT NULL,
    "kind" "BackupKind" NOT NULL,
    "trigger_type" "BackupTrigger" NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "location" VARCHAR(300),
    "size_bytes" BIGINT,
    "error_message" TEXT,
    "source_backup_id" UUID,
    "triggered_by_id" UUID,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "backup_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit" (
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(60) NOT NULL,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "tea_grade" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tea_grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_parameter" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(80) NOT NULL,
    "subject" "InspectionSubject" NOT NULL,
    "unit_code" VARCHAR(20) NOT NULL,
    "allowed_min" DECIMAL(12,3),
    "allowed_max" DECIMAL(12,3),
    "standard_min" DECIMAL(12,3),
    "standard_max" DECIMAL(12,3),
    "adjustment_min" DECIMAL(12,3),
    "adjustment_max" DECIMAL(12,3),
    "deduction_pct" DECIMAL(5,2),
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspection_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tolerance" (
    "id" UUID NOT NULL,
    "type" "ToleranceType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "value" DECIMAL(12,3) NOT NULL,
    "is_percent" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(300),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tolerance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest" (
    "id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "harvest_date" DATE NOT NULL,
    "estimated_kg" DECIMAL(10,3) NOT NULL,
    "notes" VARCHAR(300),
    "entered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_route" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "centre_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "collection_route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_request" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(20) NOT NULL,
    "producer_id" UUID NOT NULL,
    "field_id" UUID,
    "harvest_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "preferred_date" DATE NOT NULL,
    "estimated_kg" DECIMAL(10,3),
    "status" "CollectionRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduled_at" TIMESTAMPTZ(3),
    "route_id" UUID,
    "assigned_officer_id" UUID,
    "scheduled_by_id" UUID,
    "transport_job_id" UUID,
    "cancel_reason" VARCHAR(300),
    "notes" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "collection_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(300),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_receipt" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "factory_id" UUID NOT NULL,
    "received_kg" DECIMAL(10,3) NOT NULL,
    "discrepancy_kg" DECIMAL(10,3) NOT NULL,
    "discrepancy_pct" DECIMAL(7,3),
    "tolerance_id" UUID,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "review_status" "ReceiptReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "review_note" VARCHAR(500),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "received_by_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factory_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_inspection" (
    "id" UUID NOT NULL,
    "inspection_no" VARCHAR(20) NOT NULL,
    "subject" "InspectionSubject" NOT NULL,
    "green_leaf_batch_id" UUID,
    "finished_batch_id" UUID,
    "grade_id" UUID,
    "inspector_id" UUID NOT NULL,
    "inspected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(500),
    "decision" "LeafDecision",
    "adjusted_kg" DECIMAL(10,3),
    "deduction_pct" DECIMAL(5,2),
    "decision_reason" VARCHAR(500),
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quality_inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_result" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "parameter_id" UUID NOT NULL,
    "value" DECIMAL(12,3) NOT NULL,
    "within_standard" BOOLEAN NOT NULL,
    "within_adjustment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inspection_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejected_batch_exception" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "approved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejected_batch_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_batch" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "factory_id" UUID,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(500),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "processing_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_input" (
    "id" UUID NOT NULL,
    "processing_batch_id" UUID NOT NULL,
    "green_leaf_batch_id" UUID NOT NULL,
    "allocated_kg" DECIMAL(10,3) NOT NULL,
    "allocated_by_id" UUID NOT NULL,
    "allocated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_input_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_stage" (
    "id" UUID NOT NULL,
    "processing_batch_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage_type" "ProcessingStageType" NOT NULL,
    "input_kg" DECIMAL(10,3) NOT NULL,
    "output_kg" DECIMAL(10,3) NOT NULL,
    "by_product_kg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "loss_kg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "by_product_note" VARCHAR(300),
    "operator_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_reconciliation" (
    "id" UUID NOT NULL,
    "processing_batch_id" UUID NOT NULL,
    "input_kg" DECIMAL(10,3) NOT NULL,
    "output_kg" DECIMAL(10,3) NOT NULL,
    "by_product_kg" DECIMAL(10,3) NOT NULL,
    "loss_kg" DECIMAL(10,3) NOT NULL,
    "variance_kg" DECIMAL(10,3) NOT NULL,
    "variance_pct" DECIMAL(7,3) NOT NULL,
    "tolerance_id" UUID,
    "within_tolerance" BOOLEAN NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "reason" VARCHAR(500),
    "submitted_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_reason" VARCHAR(500),

    CONSTRAINT "processing_reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_tea_batch" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "grade_id" UUID,
    "quantity_kg" DECIMAL(12,3) NOT NULL,
    "input_kg" DECIMAL(12,3),
    "yield_pct" DECIMAL(6,3),
    "produced_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "release_status" "ReleaseStatus" NOT NULL DEFAULT 'NOT_RELEASED',
    "released_by_id" UUID,
    "released_at" TIMESTAMPTZ(3),
    "has_trace_gap" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "finished_tea_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finished_batch_source" (
    "finished_batch_id" UUID NOT NULL,
    "processing_batch_id" UUID NOT NULL,
    "quantity_kg" DECIMAL(12,3),

    CONSTRAINT "finished_batch_source_pkey" PRIMARY KEY ("finished_batch_id", "processing_batch_id")
);

-- CreateTable
CREATE TABLE "batch_release_event" (
    "id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "action" "ReleaseAction" NOT NULL,
    "from_status" "ReleaseStatus" NOT NULL,
    "to_status" "ReleaseStatus" NOT NULL,
    "reason" VARCHAR(500),
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_release_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_code" (
    "id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "print_count" INTEGER NOT NULL DEFAULT 1,
    "last_printed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traceability_field_setting" (
    "field_key" VARCHAR(60) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "visible_to_buyer" BOOLEAN NOT NULL DEFAULT false,
    "visible_to_farmer" BOOLEAN NOT NULL DEFAULT false,
    "is_personal_data" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "traceability_field_setting_pkey" PRIMARY KEY ("field_key")
);

-- CreateTable
CREATE TABLE "traceability_issue" (
    "id" UUID NOT NULL,
    "issue_type" "TraceIssueType" NOT NULL,
    "finished_batch_id" UUID,
    "processing_batch_id" UUID,
    "green_leaf_batch_id" UUID,
    "details" VARCHAR(500),
    "detected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_id" UUID,

    CONSTRAINT "traceability_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(300),
    "factory_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_area" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouse_area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_location" (
    "id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(80),
    "capacity_kg" DECIMAL(12,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "storage_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balance" (
    "id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "on_hand_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reserved_kg" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "quantity_kg" DECIMAL(12,3) NOT NULL,
    "order_id" UUID,
    "adjustment_id" UUID,
    "note" VARCHAR(300),
    "performed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustment" (
    "id" UUID NOT NULL,
    "adjustment_no" VARCHAR(20) NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "delta_kg" DECIMAL(12,3) NOT NULL,
    "reason" "AdjustmentReason" NOT NULL,
    "note" VARCHAR(500),
    "count_line_id" UUID,
    "status" "DecisionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_reason" VARCHAR(500),

    CONSTRAINT "stock_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count" (
    "id" UUID NOT NULL,
    "count_no" VARCHAR(20) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" VARCHAR(500),
    "counted_by_id" UUID NOT NULL,
    "counted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(3),

    CONSTRAINT "stock_count_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_line" (
    "id" UUID NOT NULL,
    "count_id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "system_kg" DECIMAL(12,3) NOT NULL,
    "counted_kg" DECIMAL(12,3) NOT NULL,
    "difference_kg" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "stock_count_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "low_stock_threshold" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "threshold_kg" DECIMAL(12,3) NOT NULL,
    "notify_roles" "Role"[],
    "status" "DecisionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_reason" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "low_stock_threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyer" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "company_name" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(120),
    "email" VARCHAR(160),
    "phone" VARCHAR(20),
    "address" VARCHAR(300),
    "country" VARCHAR(60),
    "tax_no" VARCHAR(40),
    "user_id" UUID,
    "status" "BuyerStatus" NOT NULL DEFAULT 'ACTIVE',
    "registered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "buyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(30) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "grade_id" UUID NOT NULL,
    "description" VARCHAR(1000),
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_batch" (
    "product_id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "added_by_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_batch_pkey" PRIMARY KEY ("product_id", "finished_batch_id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "id" UUID NOT NULL,
    "order_no" VARCHAR(20) NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'LKR',
    "notes" VARCHAR(500),
    "placed_by_id" UUID NOT NULL,
    "placed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(500),
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(500),
    "packed_at" TIMESTAMPTZ(3),
    "dispatched_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_kg" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "price_version_id" UUID,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_allocation" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "finished_batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "quantity_kg" DECIMAL(12,3) NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'RESERVED',
    "allocated_by_id" UUID NOT NULL,
    "allocated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(3),

    CONSTRAINT "order_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "reason" VARCHAR(500),
    "changed_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "invoice_no" VARCHAR(20) NOT NULL,
    "order_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "issued_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payment" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "reference" VARCHAR(80) NOT NULL,
    "method" VARCHAR(40),
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_adjustment_rule" (
    "id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(120) NOT NULL,
    "type" "AdjustmentRuleType" NOT NULL,
    "basis" "AdjustmentBasis" NOT NULL,
    "value" DECIMAL(12,3) NOT NULL,
    "condition" "AdjustmentCondition" NOT NULL DEFAULT 'ALWAYS',
    "decision" "LeafDecision",
    "grade_id" UUID,
    "min_period_kg" DECIMAL(12,3),
    "reason" VARCHAR(300) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_adjustment_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_payment" (
    "id" UUID NOT NULL,
    "payment_no" VARCHAR(20) NOT NULL,
    "producer_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_net_kg" DECIMAL(12,3) NOT NULL,
    "base_amount" DECIMAL(14,2) NOT NULL,
    "adjustments_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'LKR',
    "status" "FarmerPaymentStatus" NOT NULL DEFAULT 'PREPARED',
    "prepared_by_id" UUID NOT NULL,
    "prepared_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(500),
    "paid_at" TIMESTAMPTZ(3),
    "payment_reference" VARCHAR(80),
    "marked_paid_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "farmer_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_payment_line" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "net_kg" DECIMAL(10,3) NOT NULL,
    "price_per_kg" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "farmer_payment_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farmer_payment_adjustment" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "rule_id" UUID,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "farmer_payment_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transporter" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "company_name" VARCHAR(160),
    "phone" VARCHAR(20),
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" UUID NOT NULL,
    "reg_no" VARCHAR(20) NOT NULL,
    "type" VARCHAR(40),
    "capacity_kg" DECIMAL(10,3),
    "transporter_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "license_no" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20),
    "transporter_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_job" (
    "id" UUID NOT NULL,
    "job_no" VARCHAR(20) NOT NULL,
    "type" "TransportJobType" NOT NULL,
    "status" "TransportJobStatus" NOT NULL DEFAULT 'ASSIGNED',
    "transporter_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "driver_id" UUID,
    "order_id" UUID,
    "assigned_by_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMPTZ(3),
    "picked_up_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "failure_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transport_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_job_event" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "TransportJobStatus" NOT NULL,
    "note" VARCHAR(500),
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_job_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_delivery" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "recipient_name" VARCHAR(120) NOT NULL,
    "signature_url" VARCHAR(500),
    "photo_url" VARCHAR(500),
    "notes" VARCHAR(500),
    "captured_by_id" UUID NOT NULL,
    "captured_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "entity_type" VARCHAR(60),
    "entity_id" VARCHAR(60),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "recipient_roles" "Role"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_session_token_hash_key" ON "user_session"("token_hash");

-- CreateIndex
CREATE INDEX "user_session_user_id_idx" ON "user_session"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_created_at_idx" ON "audit_log"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_category_created_at_idx" ON "audit_log"("category", "created_at");

-- CreateIndex
CREATE INDEX "system_log_level_created_at_idx" ON "system_log"("level", "created_at");

-- CreateIndex
CREATE INDEX "system_log_created_at_idx" ON "system_log"("created_at");

-- CreateIndex
CREATE INDEX "backup_run_kind_started_at_idx" ON "backup_run"("kind", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "tea_grade_code_version_key" ON "tea_grade"("code", "version");

-- CreateIndex
CREATE INDEX "tea_grade_status_idx" ON "tea_grade"("status");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_parameter_code_version_key" ON "inspection_parameter"("code", "version");

-- CreateIndex
CREATE INDEX "inspection_parameter_subject_status_idx" ON "inspection_parameter"("subject", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tolerance_type_version_key" ON "tolerance"("type", "version");

-- CreateIndex
CREATE INDEX "tolerance_type_status_idx" ON "tolerance"("type", "status");

-- CreateIndex
CREATE INDEX "harvest_field_id_harvest_date_idx" ON "harvest"("field_id", "harvest_date");

-- CreateIndex
CREATE UNIQUE INDEX "collection_route_code_key" ON "collection_route"("code");

-- CreateIndex
CREATE UNIQUE INDEX "collection_request_request_no_key" ON "collection_request"("request_no");

-- CreateIndex
CREATE INDEX "collection_request_producer_id_idx" ON "collection_request"("producer_id");

-- CreateIndex
CREATE INDEX "collection_request_status_scheduled_at_idx" ON "collection_request"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "collection_request_assigned_officer_id_idx" ON "collection_request"("assigned_officer_id");

-- CreateIndex
CREATE INDEX "collection_request_transport_job_id_idx" ON "collection_request"("transport_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_request_id_key" ON "collection"("request_id");

-- CreateIndex
CREATE INDEX "green_leaf_batch_status_idx" ON "green_leaf_batch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "factory_code_key" ON "factory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "factory_receipt_batch_id_key" ON "factory_receipt"("batch_id");

-- CreateIndex
CREATE INDEX "factory_receipt_factory_id_received_at_idx" ON "factory_receipt"("factory_id", "received_at");

-- CreateIndex
CREATE INDEX "factory_receipt_review_status_idx" ON "factory_receipt"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_inspection_inspection_no_key" ON "quality_inspection"("inspection_no");

-- CreateIndex
CREATE INDEX "quality_inspection_green_leaf_batch_id_idx" ON "quality_inspection"("green_leaf_batch_id");

-- CreateIndex
CREATE INDEX "quality_inspection_finished_batch_id_idx" ON "quality_inspection"("finished_batch_id");

-- CreateIndex
CREATE INDEX "quality_inspection_inspected_at_idx" ON "quality_inspection"("inspected_at");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_result_inspection_id_parameter_id_key" ON "inspection_result"("inspection_id", "parameter_id");

-- CreateIndex
CREATE INDEX "inspection_result_parameter_id_idx" ON "inspection_result"("parameter_id");

-- CreateIndex
CREATE UNIQUE INDEX "rejected_batch_exception_batch_id_key" ON "rejected_batch_exception"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_batch_code_key" ON "processing_batch"("code");

-- CreateIndex
CREATE INDEX "processing_batch_status_idx" ON "processing_batch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "processing_input_processing_batch_id_green_leaf_batch_id_key" ON "processing_input"("processing_batch_id", "green_leaf_batch_id");

-- CreateIndex
CREATE INDEX "processing_input_green_leaf_batch_id_idx" ON "processing_input"("green_leaf_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "processing_stage_processing_batch_id_sequence_key" ON "processing_stage"("processing_batch_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "processing_reconciliation_processing_batch_id_key" ON "processing_reconciliation"("processing_batch_id");

-- CreateIndex
CREATE INDEX "processing_reconciliation_status_idx" ON "processing_reconciliation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "finished_tea_batch_code_key" ON "finished_tea_batch"("code");

-- CreateIndex
CREATE INDEX "finished_tea_batch_release_status_idx" ON "finished_tea_batch"("release_status");

-- CreateIndex
CREATE INDEX "finished_tea_batch_grade_id_idx" ON "finished_tea_batch"("grade_id");

-- CreateIndex
CREATE INDEX "finished_batch_source_processing_batch_id_idx" ON "finished_batch_source"("processing_batch_id");

-- CreateIndex
CREATE INDEX "batch_release_event_finished_batch_id_created_at_idx" ON "batch_release_event"("finished_batch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "qr_code_finished_batch_id_key" ON "qr_code"("finished_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "qr_code_token_key" ON "qr_code"("token");

-- CreateIndex
CREATE INDEX "traceability_issue_resolved_at_idx" ON "traceability_issue"("resolved_at");

-- CreateIndex
CREATE INDEX "traceability_issue_finished_batch_id_idx" ON "traceability_issue"("finished_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_code_key" ON "warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_area_warehouse_id_code_key" ON "warehouse_area"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "storage_location_area_id_code_key" ON "storage_location"("area_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balance_finished_batch_id_location_id_key" ON "stock_balance"("finished_batch_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_balance_location_id_idx" ON "stock_balance"("location_id");

-- CreateIndex
CREATE INDEX "stock_movement_finished_batch_id_created_at_idx" ON "stock_movement"("finished_batch_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movement_order_id_idx" ON "stock_movement"("order_id");

-- CreateIndex
CREATE INDEX "stock_movement_created_at_idx" ON "stock_movement"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustment_adjustment_no_key" ON "stock_adjustment"("adjustment_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_adjustment_count_line_id_key" ON "stock_adjustment"("count_line_id");

-- CreateIndex
CREATE INDEX "stock_adjustment_status_idx" ON "stock_adjustment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_count_no_key" ON "stock_count"("count_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_line_count_id_finished_batch_id_location_id_key" ON "stock_count_line"("count_id", "finished_batch_id", "location_id");

-- CreateIndex
CREATE INDEX "low_stock_threshold_product_id_status_idx" ON "low_stock_threshold"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_code_key" ON "buyer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "buyer_user_id_key" ON "buyer"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "product"("status");

-- CreateIndex
CREATE INDEX "product_batch_finished_batch_id_idx" ON "product_batch"("finished_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_order_no_key" ON "sales_order"("order_no");

-- CreateIndex
CREATE INDEX "sales_order_buyer_id_placed_at_idx" ON "sales_order"("buyer_id", "placed_at");

-- CreateIndex
CREATE INDEX "sales_order_status_idx" ON "sales_order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_order_id_product_id_key" ON "order_line"("order_id", "product_id");

-- CreateIndex
CREATE INDEX "order_allocation_order_line_id_idx" ON "order_allocation"("order_line_id");

-- CreateIndex
CREATE INDEX "order_allocation_finished_batch_id_idx" ON "order_allocation"("finished_batch_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_invoice_no_key" ON "invoice"("invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_order_id_key" ON "invoice"("order_id");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "invoice"("status");

-- CreateIndex
CREATE INDEX "invoice_payment_invoice_id_idx" ON "invoice_payment"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_adjustment_rule_code_version_key" ON "payment_adjustment_rule"("code", "version");

-- CreateIndex
CREATE INDEX "payment_adjustment_rule_status_idx" ON "payment_adjustment_rule"("status");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_payment_payment_no_key" ON "farmer_payment"("payment_no");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_payment_producer_id_period_start_period_end_key" ON "farmer_payment"("producer_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "farmer_payment_status_idx" ON "farmer_payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "farmer_payment_line_collection_id_key" ON "farmer_payment_line"("collection_id");

-- CreateIndex
CREATE INDEX "farmer_payment_line_payment_id_idx" ON "farmer_payment_line"("payment_id");

-- CreateIndex
CREATE INDEX "farmer_payment_adjustment_payment_id_idx" ON "farmer_payment_adjustment"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "transporter_code_key" ON "transporter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "transporter_user_id_key" ON "transporter"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_reg_no_key" ON "vehicle"("reg_no");

-- CreateIndex
CREATE UNIQUE INDEX "driver_license_no_key" ON "driver"("license_no");

-- CreateIndex
CREATE UNIQUE INDEX "transport_job_job_no_key" ON "transport_job"("job_no");

-- CreateIndex
CREATE INDEX "transport_job_transporter_id_status_idx" ON "transport_job"("transporter_id", "status");

-- CreateIndex
CREATE INDEX "transport_job_order_id_idx" ON "transport_job"("order_id");

-- CreateIndex
CREATE INDEX "transport_job_event_job_id_created_at_idx" ON "transport_job_event"("job_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proof_of_delivery_job_id_key" ON "proof_of_delivery"("job_id");

-- CreateIndex
CREATE INDEX "notification_user_id_is_read_created_at_idx" ON "notification"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "alert_rule_event_type_is_active_idx" ON "alert_rule"("event_type", "is_active");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permission"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_setting" ADD CONSTRAINT "system_setting_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_run" ADD CONSTRAINT "backup_run_source_backup_id_fkey" FOREIGN KEY ("source_backup_id") REFERENCES "backup_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_run" ADD CONSTRAINT "backup_run_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_grade" ADD CONSTRAINT "tea_grade_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_grade" ADD CONSTRAINT "tea_grade_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_parameter" ADD CONSTRAINT "inspection_parameter_unit_code_fkey" FOREIGN KEY ("unit_code") REFERENCES "unit"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_parameter" ADD CONSTRAINT "inspection_parameter_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_parameter" ADD CONSTRAINT "inspection_parameter_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tolerance" ADD CONSTRAINT "tolerance_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tolerance" ADD CONSTRAINT "tolerance_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest" ADD CONSTRAINT "harvest_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest" ADD CONSTRAINT "harvest_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_route" ADD CONSTRAINT "collection_route_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "collection_centre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_harvest_id_fkey" FOREIGN KEY ("harvest_id") REFERENCES "harvest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "collection_route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_assigned_officer_id_fkey" FOREIGN KEY ("assigned_officer_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_scheduled_by_id_fkey" FOREIGN KEY ("scheduled_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_request" ADD CONSTRAINT "collection_request_transport_job_id_fkey" FOREIGN KEY ("transport_job_id") REFERENCES "transport_job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "collection_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_receipt" ADD CONSTRAINT "factory_receipt_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "green_leaf_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_receipt" ADD CONSTRAINT "factory_receipt_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_receipt" ADD CONSTRAINT "factory_receipt_tolerance_id_fkey" FOREIGN KEY ("tolerance_id") REFERENCES "tolerance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_receipt" ADD CONSTRAINT "factory_receipt_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_receipt" ADD CONSTRAINT "factory_receipt_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_green_leaf_batch_id_fkey" FOREIGN KEY ("green_leaf_batch_id") REFERENCES "green_leaf_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "tea_grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_inspection" ADD CONSTRAINT "quality_inspection_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "quality_inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_result" ADD CONSTRAINT "inspection_result_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "inspection_parameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_batch_exception" ADD CONSTRAINT "rejected_batch_exception_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "green_leaf_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_batch_exception" ADD CONSTRAINT "rejected_batch_exception_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_batch" ADD CONSTRAINT "processing_batch_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_input" ADD CONSTRAINT "processing_input_processing_batch_id_fkey" FOREIGN KEY ("processing_batch_id") REFERENCES "processing_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_input" ADD CONSTRAINT "processing_input_green_leaf_batch_id_fkey" FOREIGN KEY ("green_leaf_batch_id") REFERENCES "green_leaf_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_input" ADD CONSTRAINT "processing_input_allocated_by_id_fkey" FOREIGN KEY ("allocated_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_stage" ADD CONSTRAINT "processing_stage_processing_batch_id_fkey" FOREIGN KEY ("processing_batch_id") REFERENCES "processing_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_stage" ADD CONSTRAINT "processing_stage_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_reconciliation" ADD CONSTRAINT "processing_reconciliation_processing_batch_id_fkey" FOREIGN KEY ("processing_batch_id") REFERENCES "processing_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_reconciliation" ADD CONSTRAINT "processing_reconciliation_tolerance_id_fkey" FOREIGN KEY ("tolerance_id") REFERENCES "tolerance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_reconciliation" ADD CONSTRAINT "processing_reconciliation_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_reconciliation" ADD CONSTRAINT "processing_reconciliation_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_tea_batch" ADD CONSTRAINT "finished_tea_batch_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "tea_grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_tea_batch" ADD CONSTRAINT "finished_tea_batch_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_tea_batch" ADD CONSTRAINT "finished_tea_batch_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_batch_source" ADD CONSTRAINT "finished_batch_source_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finished_batch_source" ADD CONSTRAINT "finished_batch_source_processing_batch_id_fkey" FOREIGN KEY ("processing_batch_id") REFERENCES "processing_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_release_event" ADD CONSTRAINT "batch_release_event_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_release_event" ADD CONSTRAINT "batch_release_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_code" ADD CONSTRAINT "qr_code_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_code" ADD CONSTRAINT "qr_code_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_field_setting" ADD CONSTRAINT "traceability_field_setting_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_issue" ADD CONSTRAINT "traceability_issue_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_issue" ADD CONSTRAINT "traceability_issue_processing_batch_id_fkey" FOREIGN KEY ("processing_batch_id") REFERENCES "processing_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_issue" ADD CONSTRAINT "traceability_issue_green_leaf_batch_id_fkey" FOREIGN KEY ("green_leaf_batch_id") REFERENCES "green_leaf_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_issue" ADD CONSTRAINT "traceability_issue_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_area" ADD CONSTRAINT "warehouse_area_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_location" ADD CONSTRAINT "storage_location_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "warehouse_area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balance" ADD CONSTRAINT "stock_balance_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_adjustment_id_fkey" FOREIGN KEY ("adjustment_id") REFERENCES "stock_adjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_count_line_id_fkey" FOREIGN KEY ("count_line_id") REFERENCES "stock_count_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustment" ADD CONSTRAINT "stock_adjustment_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count" ADD CONSTRAINT "stock_count_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "stock_count"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_line" ADD CONSTRAINT "stock_count_line_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_threshold" ADD CONSTRAINT "low_stock_threshold_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_threshold" ADD CONSTRAINT "low_stock_threshold_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "low_stock_threshold" ADD CONSTRAINT "low_stock_threshold_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "tea_grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_batch" ADD CONSTRAINT "product_batch_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_placed_by_id_fkey" FOREIGN KEY ("placed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_price_version_id_fkey" FOREIGN KEY ("price_version_id") REFERENCES "price_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_allocation" ADD CONSTRAINT "order_allocation_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_allocation" ADD CONSTRAINT "order_allocation_finished_batch_id_fkey" FOREIGN KEY ("finished_batch_id") REFERENCES "finished_tea_batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_allocation" ADD CONSTRAINT "order_allocation_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_allocation" ADD CONSTRAINT "order_allocation_allocated_by_id_fkey" FOREIGN KEY ("allocated_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_version" ADD CONSTRAINT "price_version_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "tea_grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_version" ADD CONSTRAINT "price_version_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_version" ADD CONSTRAINT "price_version_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_version" ADD CONSTRAINT "price_version_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustment_rule" ADD CONSTRAINT "payment_adjustment_rule_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "tea_grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustment_rule" ADD CONSTRAINT "payment_adjustment_rule_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_adjustment_rule" ADD CONSTRAINT "payment_adjustment_rule_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment" ADD CONSTRAINT "farmer_payment_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment" ADD CONSTRAINT "farmer_payment_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment" ADD CONSTRAINT "farmer_payment_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment" ADD CONSTRAINT "farmer_payment_marked_paid_by_id_fkey" FOREIGN KEY ("marked_paid_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment_line" ADD CONSTRAINT "farmer_payment_line_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "farmer_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment_line" ADD CONSTRAINT "farmer_payment_line_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment_adjustment" ADD CONSTRAINT "farmer_payment_adjustment_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "farmer_payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farmer_payment_adjustment" ADD CONSTRAINT "farmer_payment_adjustment_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "payment_adjustment_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transporter" ADD CONSTRAINT "transporter_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_transporter_id_fkey" FOREIGN KEY ("transporter_id") REFERENCES "transporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver" ADD CONSTRAINT "driver_transporter_id_fkey" FOREIGN KEY ("transporter_id") REFERENCES "transporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job" ADD CONSTRAINT "transport_job_transporter_id_fkey" FOREIGN KEY ("transporter_id") REFERENCES "transporter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job" ADD CONSTRAINT "transport_job_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job" ADD CONSTRAINT "transport_job_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job" ADD CONSTRAINT "transport_job_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job" ADD CONSTRAINT "transport_job_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job_event" ADD CONSTRAINT "transport_job_event_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transport_job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_job_event" ADD CONSTRAINT "transport_job_event_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transport_job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_captured_by_id_fkey" FOREIGN KEY ("captured_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

