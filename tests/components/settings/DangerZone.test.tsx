import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Minimal mocks — only what the settings page imports
// ---------------------------------------------------------------------------

const mockRouter = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockStore = {
  id: "store-1",
  name: "Test Café",
  address: "1 Main St",
  is_active: true,
  opening_time: "09:00",
  closing_time: "21:00",
  weekly_hours: null,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    currentStore: { store_id: "store-1", store: mockStore },
    role: "Owner",
  }),
}));

vi.mock("@/hooks/useStores", () => ({
  useStores: () => ({ updateStore: vi.fn() }),
}));

vi.mock("@/hooks/useAlertPreferences", () => ({
  useAlertPreferences: () => ({
    preferences: null,
    isLoading: false,
    updatePreferences: vi.fn(),
    isUpdating: false,
  }),
}));

vi.mock("@/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({
    preferences: null,
    isLoading: false,
    updatePreferences: vi.fn(),
    isUpdating: false,
  }),
}));

vi.mock("@/hooks/useApiKeys", () => ({
  useApiKeys: () => ({
    apiKeys: [],
    createApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWebhooks", () => ({
  useWebhooks: () => ({
    webhooks: [],
    createWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
  }),
}));

vi.mock("@/components/forms/StoreForm", () => ({ StoreForm: () => null }));
vi.mock("@/components/settings/ApiKeyForm", () => ({ ApiKeyForm: () => null }));
vi.mock("@/components/settings/WebhookForm", () => ({
  WebhookForm: () => null,
}));
vi.mock("@/components/help/PageGuide", () => ({ PageGuide: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------

import SettingsPage from "@/app/(dashboard)/settings/page";
import { toast } from "sonner";

// ---------------------------------------------------------------------------

describe("Settings page — Danger Zone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the Danger Zone section for Owner role", () => {
    render(<SettingsPage />);
    expect(screen.getByText("Danger Zone")).toBeTruthy();
    expect(screen.getByText("Delete Store")).toBeTruthy();
  });

  it("opens the confirmation dialog when Delete Store is clicked", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Delete Store"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Type/)).toBeTruthy();
  });

  it("keeps the confirm button disabled until the store name is typed", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Delete Store"));

    const confirmBtn = screen.getByRole("button", { name: "Delete store" });
    expect(confirmBtn).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText(mockStore.name), {
      target: { value: "Wrong Name" },
    });
    expect(confirmBtn).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByPlaceholderText(mockStore.name), {
      target: { value: mockStore.name },
    });
    expect(confirmBtn).toHaveProperty("disabled", false);
  });

  it("calls DELETE /api/stores/:id and redirects on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Delete Store"));

    fireEvent.change(screen.getByPlaceholderText(mockStore.name), {
      target: { value: mockStore.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete store" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(`/api/stores/${mockStore.id}`, {
        method: "DELETE",
      });
    });

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/stores");
    });

    expect(toast.success).toHaveBeenCalledWith("Store deleted");
  });

  it("shows an error toast when the API call fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        message: "Cannot delete store with assigned users.",
      }),
    });

    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Delete Store"));

    fireEvent.change(screen.getByPlaceholderText(mockStore.name), {
      target: { value: mockStore.name },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete store" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete store with assigned users.",
      );
    });

    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
