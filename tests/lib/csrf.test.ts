import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Next.js cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

describe("CSRF Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockCookieStore.get.mockReturnValue(undefined);
  });

  describe("getCSRFToken", () => {
    it("should return existing token if present", async () => {
      mockCookieStore.get.mockReturnValue({ value: "existing-token-12345" });

      const { getCSRFToken } = await import("@/lib/csrf");
      const token = await getCSRFToken();

      expect(token).toBe("existing-token-12345");
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it("should generate new token if not present", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { getCSRFToken } = await import("@/lib/csrf");
      const token = await getCSRFToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(mockCookieStore.set).toHaveBeenCalled();
    });

    it("should set cookie with correct options", async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const { getCSRFToken } = await import("@/lib/csrf");
      await getCSRFToken();

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "csrf_token",
        expect.any(String),
        expect.objectContaining({
          httpOnly: false, // Must be readable by client
          sameSite: "strict",
          path: "/",
          maxAge: 86400, // 24 hours
        }),
      );
    });
  });

  describe("validateCSRFToken", () => {
    it("should return true for matching tokens", async () => {
      const token = "valid-csrf-token-12345";
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: token }),
        },
        headers: {
          get: vi.fn().mockReturnValue(token),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(true);
    });

    it("should return false for mismatched tokens", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "cookie-token" }),
        },
        headers: {
          get: vi.fn().mockReturnValue("header-token"),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(false);
    });

    it("should return false if cookie token is missing", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: {
          get: vi.fn().mockReturnValue("header-token"),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(false);
    });

    it("should return false if header token is missing", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "cookie-token" }),
        },
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(false);
    });

    it("should return false if both tokens are missing", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue(undefined),
        },
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(false);
    });

    it("should use timing-safe comparison for different length tokens", async () => {
      const mockRequest = {
        cookies: {
          get: vi.fn().mockReturnValue({ value: "short" }),
        },
        headers: {
          get: vi.fn().mockReturnValue("longer-token"),
        },
      } as unknown as NextRequest;

      const { validateCSRFToken } = await import("@/lib/csrf");
      const result = await validateCSRFToken(mockRequest);

      expect(result).toBe(false);
    });
  });

  describe("getCSRFTokenFromCookie", () => {
    let originalDocument: typeof global.document;

    beforeEach(() => {
      originalDocument = global.document;
    });

    afterEach(() => {
      if (originalDocument !== undefined) {
        global.document = originalDocument;
      }
    });

    it("should return null in server environment", async () => {
      // @ts-expect-error - Temporarily remove document to simulate server environment
      global.document = undefined;

      vi.resetModules();
      const { getCSRFTokenFromCookie } = await import("@/lib/csrf");
      const result = getCSRFTokenFromCookie();

      expect(result).toBeNull();
    });

    it("should return token from cookie", async () => {
      // @ts-expect-error - Setting partial document mock for testing
      global.document = {
        cookie: "csrf_token=my-csrf-token; other_cookie=value",
      };

      vi.resetModules();
      const { getCSRFTokenFromCookie } = await import("@/lib/csrf");
      const result = getCSRFTokenFromCookie();

      expect(result).toBe("my-csrf-token");
    });

    it("should return null if token not found", async () => {
      // @ts-expect-error - Setting partial document mock for testing
      global.document = { cookie: "other_cookie=value" };

      vi.resetModules();
      const { getCSRFTokenFromCookie } = await import("@/lib/csrf");
      const result = getCSRFTokenFromCookie();

      expect(result).toBeNull();
    });

    it("should handle token at beginning of cookie string", async () => {
      // @ts-expect-error - Setting partial document mock for testing
      global.document = { cookie: "csrf_token=first-token" };

      vi.resetModules();
      const { getCSRFTokenFromCookie } = await import("@/lib/csrf");
      const result = getCSRFTokenFromCookie();

      expect(result).toBe("first-token");
    });
  });

  describe("getCSRFHeaders", () => {
    let originalDocument: typeof global.document;

    beforeEach(() => {
      originalDocument = global.document;
    });

    afterEach(() => {
      if (originalDocument !== undefined) {
        global.document = originalDocument;
      }
    });

    it("should return headers with CSRF token", async () => {
      // @ts-expect-error - Setting partial document mock for testing
      global.document = { cookie: "csrf_token=header-test-token" };

      vi.resetModules();
      const { getCSRFHeaders } = await import("@/lib/csrf");
      const headers = getCSRFHeaders();

      expect(headers).toEqual({
        "x-csrf-token": "header-test-token",
      });
    });

    it("should return empty object if no token", async () => {
      // @ts-expect-error - Setting partial document mock for testing
      global.document = { cookie: "" };

      vi.resetModules();
      const { getCSRFHeaders } = await import("@/lib/csrf");
      const headers = getCSRFHeaders();

      expect(headers).toEqual({});
    });
  });
});
