-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADM', 'MGT', 'FRM', 'COL', 'FAC', 'QO', 'WH', 'BUY', 'TRN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ProducerType" AS ENUM ('SMALLHOLDER', 'ESTATE', 'ORG_MEMBER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FieldStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('IN_TRANSIT', 'RECEIVED', 'ACCEPTED', 'ADJUSTED', 'REJECTED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('PURCHASE_GL', 'SELLING_FT');

-- CreateEnum
CREATE TYPE "PriceStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(20),
    "password_hash" TEXT NOT NULL,
    "roles" "Role"[],
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_centre" (
    "id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,

    CONSTRAINT "collection_centre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer_org" (
    "id" UUID NOT NULL,
    "reg_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "producer_org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producer" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "type" "ProducerType" NOT NULL,
    "full_name" VARCHAR(120) NOT NULL,
    "nic_or_reg_no" VARCHAR(30) NOT NULL,
    "phone" VARCHAR(20),
    "address" VARCHAR(300),
    "centre_id" UUID NOT NULL,
    "org_id" UUID,
    "user_id" UUID,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" VARCHAR(300),
    "registered_by_id" UUID NOT NULL,
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "producer_id" UUID NOT NULL,
    "division" VARCHAR(80),
    "area_ha" DECIMAL(10,3) NOT NULL,
    "variety" VARCHAR(80),
    "gps_lat" DOUBLE PRECISION,
    "gps_lng" DOUBLE PRECISION,
    "status" "FieldStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_version" (
    "id" UUID NOT NULL,
    "price_type" "PriceType" NOT NULL,
    "version" INTEGER NOT NULL,
    "price_per_kg" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'LKR',
    "effective_from" TIMESTAMPTZ(3) NOT NULL,
    "status" "PriceStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "price_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection" (
    "id" UUID NOT NULL,
    "receipt_no" VARCHAR(20) NOT NULL,
    "producer_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "centre_id" UUID,
    "collector_id" UUID NOT NULL,
    "collected_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gross_kg" DECIMAL(10,3) NOT NULL,
    "tare_kg" DECIMAL(10,3) NOT NULL,
    "net_kg" DECIMAL(10,3) NOT NULL,
    "purchase_price_id" UUID NOT NULL,
    "price_per_kg" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "green_leaf_batch" (
    "id" UUID NOT NULL,
    "batch_code" VARCHAR(30) NOT NULL,
    "collection_id" UUID NOT NULL,
    "net_kg" DECIMAL(10,3) NOT NULL,
    "accepted_kg" DECIMAL(10,3),
    "status" "BatchStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "green_leaf_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "collection_centre_code_key" ON "collection_centre"("code");

-- CreateIndex
CREATE UNIQUE INDEX "producer_org_reg_no_key" ON "producer_org"("reg_no");

-- CreateIndex
CREATE UNIQUE INDEX "producer_code_key" ON "producer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "producer_nic_or_reg_no_key" ON "producer"("nic_or_reg_no");

-- CreateIndex
CREATE INDEX "producer_user_id_idx" ON "producer"("user_id");

-- CreateIndex
CREATE INDEX "producer_verification_status_idx" ON "producer"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "field_code_key" ON "field"("code");

-- CreateIndex
CREATE INDEX "field_producer_id_idx" ON "field"("producer_id");

-- CreateIndex
CREATE INDEX "price_version_price_type_status_effective_from_idx" ON "price_version"("price_type", "status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "price_version_price_type_version_key" ON "price_version"("price_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "collection_receipt_no_key" ON "collection"("receipt_no");

-- CreateIndex
CREATE INDEX "collection_producer_id_idx" ON "collection"("producer_id");

-- CreateIndex
CREATE INDEX "collection_collected_at_idx" ON "collection"("collected_at");

-- CreateIndex
CREATE INDEX "collection_collector_id_collected_at_idx" ON "collection"("collector_id", "collected_at");

-- CreateIndex
CREATE UNIQUE INDEX "green_leaf_batch_batch_code_key" ON "green_leaf_batch"("batch_code");

-- CreateIndex
CREATE UNIQUE INDEX "green_leaf_batch_collection_id_key" ON "green_leaf_batch"("collection_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "collection_centre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "producer_org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producer" ADD CONSTRAINT "producer_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field" ADD CONSTRAINT "field_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_producer_id_fkey" FOREIGN KEY ("producer_id") REFERENCES "producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "field"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "collection_centre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_collector_id_fkey" FOREIGN KEY ("collector_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection" ADD CONSTRAINT "collection_purchase_price_id_fkey" FOREIGN KEY ("purchase_price_id") REFERENCES "price_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "green_leaf_batch" ADD CONSTRAINT "green_leaf_batch_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

