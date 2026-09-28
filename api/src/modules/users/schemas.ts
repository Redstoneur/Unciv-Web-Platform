import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../../lib/locales.js';

export const emailSchema = z.email().max(254).trim().toLowerCase();
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[\p{L}\p{N}_.-]+$/u, 'Only letters, digits, "_", "." and "-" are allowed');
export const passwordSchema = z.string().min(8).max(128);
export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const httpUrlSchema = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .transform((url) => url.replace(/\/+$/, ''));
