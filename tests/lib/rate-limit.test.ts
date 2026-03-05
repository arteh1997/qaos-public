import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  rateLimit,
  getRateLimitHeaders,
  RATE_LIMITS,
  RateLimitConfig,
} from "@/lib/rate-limit";

describe("Rate Limiter", () => {
  // Store original Date.now for restoration
  const originalDateNow = Date.now;

  beforeEach(() => {
    // Reset the rate limit store by using unique identifiers per test
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Date.now = originalDateNow;
  });

  describe("rateLimit function", () => {
    const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

    it("should allow first request and return correct remaining count", async () => {
      const identifier = `test-first-${Date.now()}`;
      const result = await rateLimit(identifier, config);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.limit).toBe(5);
    });

    it("should decrement remaining count on subsequent requests", async () => {
      const identifier = `test-decrement-${Date.now()}`;

      const result1 = await rateLimit(identifier, config);
      expect(result1.remaining).toBe(4);

      const result2 = await rateLimit(identifier, config);
      expect(result2.remaining).toBe(3);

      const result3 = await rateLimit(identifier, config);
      expect(result3.remaining).toBe(2);
    });

    it("should block requests when limit is exceeded", async () => {
      const identifier = `test-block-${Date.now()}`;

      // Use all allowed requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimit(identifier, config);
        expect(result.success).toBe(true);
      }

      // 6th request should be blocked
      const blockedResult = await rateLimit(identifier, config);
      expect(blockedResult.success).toBe(false);
      expect(blockedResult.remaining).toBe(0);
    });

    it("should reset after window expires", async () => {
      const identifier = `test-reset-${Date.now()}`;

      // Use all requests
      for (let i = 0; i < 5; i++) {
        await rateLimit(identifier, config);
      }

      // Verify blocked
      const blockedResult = await rateLimit(identifier, config);
      expect(blockedResult.success).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(60001);

      // Should be allowed again
      const result = await rateLimit(identifier, config);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should track different identifiers separately", async () => {
      const identifier1 = `test-separate-1-${Date.now()}`;
      const identifier2 = `test-separate-2-${Date.now()}`;

      // Use all requests for identifier1
      for (let i = 0; i < 5; i++) {
        await rateLimit(identifier1, config);
      }

      // identifier1 should be blocked
      const result1 = await rateLimit(identifier1, config);
      expect(result1.success).toBe(false);

      // identifier2 should still be allowed
      const result2 = await rateLimit(identifier2, config);
      expect(result2.success).toBe(true);
    });

    it("should return correct resetTime", async () => {
      const identifier = `test-resettime-${Date.now()}`;
      const now = Date.now();

      const result = await rateLimit(identifier, config);

      expect(result.resetTime).toBe(now + config.windowMs);
    });

    it("should handle edge case of exactly hitting the limit", async () => {
      const identifier = `test-exact-${Date.now()}`;

      // Use exactly limit-1 requests
      for (let i = 0; i < 4; i++) {
        await rateLimit(identifier, config);
      }

      // Last allowed request
      const lastAllowed = await rateLimit(identifier, config);
      expect(lastAllowed.success).toBe(true);
      expect(lastAllowed.remaining).toBe(0);

      // Next should be blocked
      const blocked = await rateLimit(identifier, config);
      expect(blocked.success).toBe(false);
    });
  });

  describe("getRateLimitHeaders", () => {
    it("should return correct headers for rate limit result", () => {
      const result = {
        success: true,
        remaining: 95,
        resetTime: 1704067200000,
        limit: 100,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers).toEqual({
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "95",
        "X-RateLimit-Reset": "1704067200000",
      });
    });

    it("should handle zero remaining correctly", () => {
      const result = {
        success: false,
        remaining: 0,
        resetTime: 1704067200000,
        limit: 100,
      };

      const headers = getRateLimitHeaders(result) as Record<string, string>;

      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });
  });

  describe("RATE_LIMITS presets", () => {
    it("should have correct api rate limit", () => {
      expect(RATE_LIMITS.api).toEqual({
        limit: 200,
        windowMs: 60000,
      });
    });

    it("should have correct auth rate limit (more restrictive)", () => {
      expect(RATE_LIMITS.auth).toEqual({
        limit: 10,
        windowMs: 60000,
      });
    });

    it("should have correct createUser rate limit (most restrictive)", () => {
      expect(RATE_LIMITS.createUser).toEqual({
        limit: 5,
        windowMs: 60000,
      });
    });

    it("should have correct reports rate limit", () => {
      expect(RATE_LIMITS.reports).toEqual({
        limit: 20,
        windowMs: 60000,
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle very short window durations", async () => {
      const identifier = `test-short-${Date.now()}`;
      const shortConfig: RateLimitConfig = { limit: 2, windowMs: 100 };

      await rateLimit(identifier, shortConfig);
      await rateLimit(identifier, shortConfig);

      // Should be blocked
      const blockedResult = await rateLimit(identifier, shortConfig);
      expect(blockedResult.success).toBe(false);

      // After short window, should reset
      vi.advanceTimersByTime(101);
      const allowedResult = await rateLimit(identifier, shortConfig);
      expect(allowedResult.success).toBe(true);
    });

    it("should handle limit of 1", async () => {
      const identifier = `test-one-${Date.now()}`;
      const oneConfig: RateLimitConfig = { limit: 1, windowMs: 60000 };

      const first = await rateLimit(identifier, oneConfig);
      expect(first.success).toBe(true);
      expect(first.remaining).toBe(0);

      const second = await rateLimit(identifier, oneConfig);
      expect(second.success).toBe(false);
    });

    it("should handle empty identifier string", async () => {
      const config: RateLimitConfig = { limit: 5, windowMs: 60000 };

      // Empty string is still a valid identifier
      const result = await rateLimit("", config);
      expect(result.success).toBe(true);
    });
  });
});
