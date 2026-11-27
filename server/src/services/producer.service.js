// Producer verification – US-015 (ESPTSCMS-80). Status transitions: PENDING -> VERIFIED | REJECTED.
import { prisma } from '../config/db.js';
import { ApiError } from '../middleware/errors.js';
import { audit } from './audit.js';

/**
 * Moves a PENDING producer to VERIFIED or REJECTED and writes the audit entry in the same transaction.
 *
 * The status change is a conditional update (`WHERE verification_status = 'PENDING'`), so when two
 * managers act on the same producer at the same time exactly one wins and the other gets 409, and the
 * audit log always matches the data. If the update or the audit write fails, nothing is changed.
 */
export async function decideVerification({ req, producerId, decision, reason = null, include }) {
  const status = decision === 'verify' ? 'VERIFIED' : 'REJECTED';
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.producer.updateMany({
      where: { id: producerId, verificationStatus: 'PENDING' },
      data: {
        verificationStatus: status,
        verifiedById: req.user.id,
        verifiedAt: new Date(),
        rejectionReason: status === 'REJECTED' ? reason : null,
      },
    });
    if (count === 0) {
      const current = await tx.producer.findUnique({ where: { id: producerId }, select: { verificationStatus: true } });
      if (!current) throw ApiError.notFound('Producer not found');
      throw ApiError.conflict(current.verificationStatus === 'VERIFIED' && status === 'VERIFIED'
        ? 'Producer is already verified'
        : `Only pending producers can be ${status === 'VERIFIED' ? 'verified' : 'rejected'} (current status: ${current.verificationStatus})`);
    }
    await audit({
      req, tx, action: status === 'VERIFIED' ? 'PRODUCER_VERIFIED' : 'PRODUCER_REJECTED',
      entityType: 'Producer', entityId: producerId,
      oldValue: { verificationStatus: 'PENDING' }, newValue: { verificationStatus: status },
      reason: status === 'REJECTED' ? reason : null,
    });
    return tx.producer.findUnique({ where: { id: producerId }, include });
  });
}
