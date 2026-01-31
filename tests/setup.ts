import { beforeEach, vi } from 'vitest'

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})

// Mock Next.js server components
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      json: async () => data,
      status: init?.status ?? 200,
      headers: new Map(Object.entries(init?.headers ?? {})),
    })),
  },
  NextRequest: vi.fn(),
}))
