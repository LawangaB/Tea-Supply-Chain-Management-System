/**
 * Enum values used by validation and business rules. They mirror the Postgres enums in
 * prisma/schema.prisma (a test checks that they stay in sync). Role codes are ROLE_CODES in permissions.js.
 */
export const USER_STATUSES = ['ACTIVE', 'DEACTIVATED'];
export const PRODUCER_TYPES = ['SMALLHOLDER', 'ESTATE', 'ORG_MEMBER'];
export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];
export const FIELD_STATUSES = ['ACTIVE', 'INACTIVE'];
export const BATCH_STATUSES = ['IN_TRANSIT', 'RECEIVED', 'ACCEPTED', 'ADJUSTED', 'REJECTED', 'CONSUMED'];
export const PRICE_TYPES = ['PURCHASE_GL', 'SELLING_FT'];
export const PRICE_STATUSES = ['DRAFT', 'APPROVED', 'RETIRED'];
