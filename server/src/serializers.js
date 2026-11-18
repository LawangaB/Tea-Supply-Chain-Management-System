/**
 * Turn Prisma rows into the JSON shapes the API has always returned (Mongo-era shapes):
 * `id` → `_id`, Decimal → number, FK columns under their old names (centreId → centre, …),
 * GPS as a nested { lat, lng } object (left out when not set). The client depends on these shapes.
 */

/** Decimal / number / null → number / null. */
export const num = (v) => (v === null || v === undefined ? v : Number(v));

const ref = (included, fkValue, out) => (included ? out(included) : (fkValue ?? null));
const pickRef = (r) => r && { _id: r.id, ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'id')) };

export function centreOut(c) {
  return c && { _id: c.id, code: c.code, name: c.name, district: c.district };
}

export function orgOut(o) {
  return o && { _id: o.id, regNo: o.regNo, name: o.name };
}

export function userOut(u) {
  if (!u) return u;
  const { id, passwordHash, ...rest } = u; // eslint-disable-line no-unused-vars
  return { _id: id, ...rest };
}

export function fieldOut(f) {
  if (!f) return f;
  const { id, producerId, gpsLat, gpsLng, areaHa, producer, ...rest } = f; // eslint-disable-line no-unused-vars
  return {
    _id: id,
    code: rest.code,
    producer: producerId,
    division: rest.division,
    areaHa: num(areaHa),
    variety: rest.variety,
    ...(gpsLat !== null && gpsLat !== undefined ? { gps: { lat: gpsLat, lng: gpsLng } } : {}),
    status: rest.status,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
}

/** Producer with whatever relations were included (centre, org, registeredBy, verifiedBy). */
export function producerOut(p) {
  if (!p) return p;
  return {
    _id: p.id,
    code: p.code,
    type: p.type,
    fullName: p.fullName,
    nicOrRegNo: p.nicOrRegNo,
    phone: p.phone,
    address: p.address,
    centre: ref(p.centre, p.centreId, centreOut),
    org: ref(p.org, p.orgId, orgOut),
    user: p.userId ?? null,
    verificationStatus: p.verificationStatus,
    rejectionReason: p.rejectionReason,
    registeredBy: ref(p.registeredBy, p.registeredById, pickRef),
    verifiedBy: ref(p.verifiedBy, p.verifiedById, pickRef),
    verifiedAt: p.verifiedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
