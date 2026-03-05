import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the alert service
const mockProcessScheduledAlerts = vi.fn();
vi.mock("@/lib/services/alertService", () => ({
  processScheduledAlerts: (...args: unknown[]) =>
    mockProcessScheduledAlerts(...args),
}));

function createMockRequest(headers?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:3000/api/cron/send-alerts");

  const headersObj = new Headers(headers);

  return {
    method: "POST",
    nextUrl: url,
    url: url.toString(),
    json: vi.fn(() => Promise.resolve({})),
    headers: headersObj,
    cookies: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as NextRequest;
}

describe("Cron Alerts API", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("POST /api/cron/send-alerts", () => {
    it("should return 401 without authorization header", async () => {
      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest();
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should return 401 with wrong secret", async () => {
      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest({
        authorization: "Bearer wrong-secret",
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should process alerts with valid secret", async () => {
      mockProcessScheduledAlerts.mockResolvedValue([
        {
          store_id: "store-1",
          store_name: "Test Store",
          user_id: "user-1",
          user_email: "test@example.com",
          alert_type: "low_stock",
          items_count: 3,
          success: true,
        },
      ]);

      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest({
        authorization: "Bearer test-cron-secret",
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.processed).toBe(1);
      expect(body.data.sent).toBe(1);
      expect(body.data.failed).toBe(0);
    });

    it("should handle no alerts to process", async () => {
      mockProcessScheduledAlerts.mockResolvedValue([]);

      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest({
        authorization: "Bearer test-cron-secret",
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.processed).toBe(0);
    });

    it("should report mixed results", async () => {
      mockProcessScheduledAlerts.mockResolvedValue([
        {
          store_id: "s1",
          store_name: "Store 1",
          alert_type: "low_stock",
          success: true,
        },
        {
          store_id: "s2",
          store_name: "Store 2",
          alert_type: "critical_stock",
          success: false,
          error: "Email failed",
        },
      ]);

      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest({
        authorization: "Bearer test-cron-secret",
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.sent).toBe(1);
      expect(body.data.failed).toBe(1);
    });

    it("should return 503 when CRON_SECRET not configured", async () => {
      delete process.env.CRON_SECRET;

      const { POST } = await import("@/app/api/cron/send-alerts/route");
      const request = createMockRequest({
        authorization: "Bearer test-cron-secret",
      });
      const response = await POST(request);

      expect(response.status).toBe(503);
    });
  });
});
