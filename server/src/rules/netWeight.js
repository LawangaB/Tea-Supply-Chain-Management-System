/**
 * Green-leaf weighing rule (US-020 / ESPTSCMS-20): netKg = grossKg - tareKg.
 * Always computed on the server; any netKg sent by a client is ignored.
 */
export const MAX_GROSS_KG = 10000;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Returns a list of {field, message}; empty when the weights are valid. */
export function weightErrors(grossKg, tareKg) {
  const errors = [];
  if (!isNum(grossKg)) errors.push({ field: 'grossKg', message: 'Gross weight must be a number' });
  else if (grossKg <= 0) errors.push({ field: 'grossKg', message: 'Gross weight must be greater than 0' });
  else if (grossKg > MAX_GROSS_KG) errors.push({ field: 'grossKg', message: `Gross weight cannot exceed ${MAX_GROSS_KG} kg` });

  if (!isNum(tareKg)) errors.push({ field: 'tareKg', message: 'Tare weight must be a number' });
  else if (tareKg < 0) errors.push({ field: 'tareKg', message: 'Tare weight cannot be negative' });
  else if (isNum(grossKg) && grossKg > 0 && tareKg >= grossKg) {
    errors.push({ field: 'tareKg', message: 'Tare weight must be less than gross weight' });
  }
  return errors;
}

/** Rounds to 3 dp (gram precision) to remove floating-point noise. */
export const roundKg = (n) => Math.round(n * 1000) / 1000;

export class WeightError extends Error {
  constructor(fields) {
    super('Invalid weights');
    this.fields = fields;
  }
}

/** Returns the net weight, or throws WeightError (with field errors) when invalid. */
export function computeNetKg(grossKg, tareKg) {
  const errors = weightErrors(grossKg, tareKg);
  if (errors.length) throw new WeightError(errors);
  return roundKg(grossKg - tareKg);
}
