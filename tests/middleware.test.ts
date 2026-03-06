import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock next/server
vi.mock("next/server", () => {
  const headers = new Map<string, string>();
  const cookies = new Map<
    string,
    {
      value: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: string;
      path?: string;
      maxAge?: number;
    }
  >();

  const mockResponse = {
    headers: {
      set: (key: string, value: string) => headers.set(key, value),
      get: (key: string) => headers.get(key),
    },
    cookies: {
      set: (name: string, value: string, options?: object) =>
        cookies.set(name, { value, ...options }),
      get: (name: string) => cookies.get(name),
    },
  };

  return {
    NextRequest: vi.fn(),
    NextResponse: {
      next: vi.fn(() => {
        headers.clear();
        cookies.clear();
        return mockResponse;
      }),
      redirect: vi.fn(() => {
        headers.clear();
        cookies.clear();
        return mockResponse;
      }),
    },
    _headers: headers,
    _cookies: cookies,
  };
});

// Mock constants
vi.mock("@/lib/constants", () => ({
  PUBLIC_ROUTES: ["/login", "/api/auth"],
}));

function createMockRequest(pathname: string, hasCookie = false): NextRequest {
  const cookieList = hasCookie
    ? [{ name: "sb-abc-auth-token", value: "token" }]
    : [];

  return {
    nextUrl: {
      pathname,
      clone: () => ({ pathname, searchParams: { set: vi.fn() } }),
    },
    cookies: {
      getAll: () => cookieList,
      get: (name: string) => cookieList.find((c) => c.name === name),
    },
  } as unknown as NextRequest;
}

describe("middleware security headers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("Content-Security-Policy header", () => {
    it("is enforcing mode (not report-only)", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy");

      expect(csp).toBeTruthy();
      // Ensure no report-only header is set via the enforcing header name
      const reportOnly = res.headers.get("Content-Security-Policy-Report-Only");
      expect(reportOnly).toBeFalsy();
    });

    it("whitelists Stripe domains", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("https://js.stripe.com");
      expect(csp).toContain("https://api.stripe.com");
    });

    it("whitelists Sentry domains", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("https://*.sentry.io");
    });

    it("whitelists Vercel Analytics domains", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("https://va.vercel-scripts.com");
      expect(csp).toContain("https://vitals.vercel-insights.com");
    });

    it("whitelists Google OAuth domains", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("https://accounts.google.com");
      expect(csp).toContain("https://oauth2.googleapis.com");
    });

    it("whitelists Supabase domains", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("https://*.supabase.co");
      expect(csp).toContain("wss://*.supabase.co");
    });

    it("includes default-src self", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);
      const csp = res.headers.get("Content-Security-Policy")!;

      expect(csp).toContain("default-src 'self'");
    });
  });

  describe("other security headers", () => {
    it("sets X-Frame-Options to DENY", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);

      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("sets X-Content-Type-Options to nosniff", async () => {
      const { middleware } = await import("@/middleware");
      const req = createMockRequest("/dashboard", true);
      const res = await middleware(req);

      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });
});
