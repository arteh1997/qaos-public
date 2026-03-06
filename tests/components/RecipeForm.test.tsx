import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecipeForm } from "@/components/recipes/RecipeForm";
import type { Recipe } from "@/types";

const noop = vi.fn();

describe("RecipeForm", () => {
  it("renders yield quantity and yield unit fields", () => {
    render(
      <RecipeForm
        open={true}
        onOpenChange={noop}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByLabelText(/yield \*/i)).toBeTruthy();
    expect(screen.getByLabelText(/yield unit \*/i)).toBeTruthy();
  });

  it("defaults yield to 1 serving when no recipe provided", () => {
    render(
      <RecipeForm
        open={true}
        onOpenChange={noop}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );
    const yieldInput = screen.getByLabelText(/yield \*/i) as HTMLInputElement;
    const unitInput = screen.getByLabelText(
      /yield unit \*/i,
    ) as HTMLInputElement;
    expect(yieldInput.value).toBe("1");
    expect(unitInput.value).toBe("serving");
  });

  it("pre-fills yield fields from existing recipe", () => {
    const recipe = {
      id: "abc",
      store_id: "store-1",
      name: "Caesar Salad",
      description: null,
      category: "Salads",
      yield_quantity: 4,
      yield_unit: "portions",
      prep_time_minutes: null,
      is_active: true,
      created_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    } satisfies Recipe;

    render(
      <RecipeForm
        open={true}
        onOpenChange={noop}
        onSubmit={vi.fn()}
        isSubmitting={false}
        recipe={recipe}
      />,
    );
    const yieldInput = screen.getByLabelText(/yield \*/i) as HTMLInputElement;
    const unitInput = screen.getByLabelText(
      /yield unit \*/i,
    ) as HTMLInputElement;
    expect(yieldInput.value).toBe("4");
    expect(unitInput.value).toBe("portions");
  });
});
