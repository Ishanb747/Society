import { z } from "zod";
import { CATEGORIES, FLAT_ID_RE, STATUSES } from "./constants";

/** Indian mobile number: strips spaces, +91 and a leading 0, then requires 10 digits starting 6-9. */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?91/, "").replace(/^0/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

export const otpSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const flatIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(FLAT_ID_RE, "Flat ID looks like T12-0408");

export const complaintTextSchema = z
  .string()
  .trim()
  .min(10, "Describe the problem in a few words (at least 10 characters)")
  .max(1000, "Please keep it under 1000 characters");

export const categorySchema = z.enum(CATEGORIES);
export const statusSchema = z.enum(STATUSES);
export const ratingSchema = z.coerce.number().int().min(1).max(5);
export const noteSchema = z.string().trim().max(500).optional();

export const payAmountSchema = z.coerce.number().int().min(1, "Enter an amount").max(10_000_000);

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_PHOTO_DATA_URL = 600_000; // characters; client resizes to ~150 KB first
export const photoDataUrlSchema = z
  .string()
  .max(MAX_PHOTO_DATA_URL, "Photo is too large")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Unsupported image");
