import { z } from 'zod';
import { ROLE_CODES } from '../rules/permissions.js';
import { PRODUCER_TYPES } from '../models/Producer.js';

export const objectId = (label = 'id') => z.string({ message: `${label} is required` })
  .regex(/^[0-9a-fA-F]{24}$/, `Invalid ${label}`);

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

const phone = z.string().trim()
  .regex(/^\+?[0-9 ]{9,15}$/, 'Enter a valid phone number, e.g. 0771234567')
  .optional().or(z.literal('').transform(() => undefined));

// Password policy: >= 8 chars with upper, lower and a digit.
const password = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[0-9]/, 'Password needs a number');

export const loginSchema = z.object({
  email: z.string({ message: 'Email is required' }).trim().toLowerCase().min(1, 'Email is required'),
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required'),
});

const roles = z.array(z.enum(ROLE_CODES)).min(1, 'Select at least one role')
  .transform((r) => [...new Set(r)]);

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone,
  password,
  roles,
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone,
  password: password.optional(),
  roles: roles.optional(),
  status: z.enum(['ACTIVE', 'DEACTIVATED']).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

// Sri Lankan NIC: old format 9 digits + V/X, new format 12 digits.
export const NIC_RE = /^(\d{9}[VXvx]|\d{12})$/;

export const fieldSchema = z.object({
  division: optionalText(80),
  areaHa: z.number({ message: 'Area (ha) must be a number' }).positive('Area must be greater than 0').max(10000),
  variety: optionalText(80),
  gps: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
});

export const createProducerSchema = z.object({
  type: z.enum(PRODUCER_TYPES, { message: 'Select a producer type' }),
  fullName: z.string({ message: 'Full name is required' }).trim().min(2, 'Full name is required').max(120),
  nicOrRegNo: z.string({ message: 'NIC / registration no. is required' }).trim().toUpperCase().min(5, 'NIC / registration no. is required').max(30),
  phone,
  address: optionalText(300),
  centreId: objectId('collection centre'),
  orgId: objectId('producer organisation').optional().or(z.literal('').transform(() => undefined)),
  fields: z.array(fieldSchema).max(20).optional().default([]),
}).superRefine((v, ctx) => {
  if (v.type !== 'ESTATE' && !NIC_RE.test(v.nicOrRegNo)) {
    ctx.addIssue({ code: 'custom', path: ['nicOrRegNo'], message: 'Enter a valid NIC (e.g. 851234567V or 198512345678)' });
  }
  if (v.type === 'ORG_MEMBER' && !v.orgId) {
    ctx.addIssue({ code: 'custom', path: ['orgId'], message: 'Select the producer organisation' });
  }
});

export const rejectProducerSchema = z.object({
  reason: z.string({ message: 'A reason is required' }).trim().min(3, 'A reason is required').max(300),
});

/** Weights are validated by rules/netWeight.js so that the messages are the same everywhere. */
export const createCollectionSchema = z.object({
  producerId: objectId('producer'),
  fieldId: objectId('field'),
  grossKg: z.unknown(),
  tareKg: z.unknown(),
  collectedAt: z.coerce.date({ message: 'Invalid date/time' }).optional(),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
