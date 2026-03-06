import { beforeEach, vi } from "vitest";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Mock Next.js server components
vi.mock("next/server", () => {
  class MockNextResponse {
    status: number;
    headers: Headers;
    _body: unknown;

    constructor(body: unknown, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers as HeadersInit | undefined);
      this._body = body;
    }

    static json(
      data: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      const res = new MockNextResponse(null, {
        status: init?.status ?? 200,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      (res as { json: () => Promise<unknown> }).json = async () => data;
      return res;
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: vi.fn(),
  };
});
