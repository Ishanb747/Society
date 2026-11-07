import { describe, expect, it } from "vitest";
import { complaintTextSchema, flatIdSchema, otpSchema, payAmountSchema, phoneSchema, photoDataUrlSchema, ratingSchema } from "@/lib/validation";

describe("phoneSchema", () => {
  it.each([["98765 43210", "9876543210"], ["+91 98765-43210", "9876543210"], ["09876543210", "9876543210"]])("normalises %s", (input, out) => {
    expect(phoneSchema.parse(input)).toBe(out);
  });
  it.each(["12345", "1234567890", "98765abcde", ""])("rejects %s", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("otp, flat id, rating", () => {
  it("needs exactly six digits", () => {
    expect(otpSchema.safeParse("123456").success).toBe(true);
    expect(otpSchema.safeParse("12345").success).toBe(false);
    expect(otpSchema.safeParse("12345a").success).toBe(false);
  });
  it("normalises and checks flat ids", () => {
    expect(flatIdSchema.parse(" t12-0408 ")).toBe("T12-0408");
    expect(flatIdSchema.safeParse("12-0408").success).toBe(false);
    expect(flatIdSchema.safeParse("T12-0408; DROP TABLE").success).toBe(false);
  });
  it("accepts ratings 1 to 5 only", () => {
    expect(ratingSchema.parse("4")).toBe(4);
    expect(ratingSchema.safeParse("0").success).toBe(false);
    expect(ratingSchema.safeParse("6").success).toBe(false);
  });
});

describe("complaint text and payment amount", () => {
  it("rejects empty, tiny and huge complaint text", () => {
    expect(complaintTextSchema.safeParse("  hi  ").success).toBe(false);
    expect(complaintTextSchema.safeParse("x".repeat(1001)).success).toBe(false);
    expect(complaintTextSchema.parse("  Tap is leaking in kitchen  ")).toBe("Tap is leaking in kitchen");
  });
  it("rejects zero, negative and fractional amounts", () => {
    expect(payAmountSchema.parse("2000")).toBe(2000);
    for (const bad of ["0", "-5", "12.5", "abc", ""]) expect(payAmountSchema.safeParse(bad).success).toBe(false);
  });
});

describe("photoDataUrlSchema", () => {
  it("accepts a small image data URL", () => {
    expect(photoDataUrlSchema.safeParse("data:image/jpeg;base64,/9j/4AAQSkZJRg==").success).toBe(true);
  });
  it("rejects scripts, other types and oversized payloads", () => {
    expect(photoDataUrlSchema.safeParse("data:text/html;base64,PHNjcmlwdD4=").success).toBe(false);
    expect(photoDataUrlSchema.safeParse("data:image/svg+xml;base64,PHN2Zz4=").success).toBe(false);
    expect(photoDataUrlSchema.safeParse("data:image/jpeg;base64," + "A".repeat(700_000)).success).toBe(false);
  });
});
