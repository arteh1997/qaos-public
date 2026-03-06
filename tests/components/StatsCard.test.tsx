import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCard } from "@/components/cards/StatsCard";

describe("StatsCard", () => {
  it("renders title and value", () => {
    render(<StatsCard title="Total Items" value={42} />);
    expect(screen.getByText("Total Items")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      <StatsCard title="Items" value={10} description="Below PAR level" />,
    );
    expect(screen.getByText("Below PAR level")).toBeTruthy();
  });

  it("omits description when not provided", () => {
    render(<StatsCard title="Items" value={10} />);
    expect(screen.queryByRole("paragraph")).toBeNull();
  });

  it("default variant has no coloured border or background", () => {
    const { container } = render(
      <StatsCard title="Info" value={5} variant="default" />,
    );
    const card = container.firstElementChild;
    expect(card?.className).not.toContain("border-amber");
    expect(card?.className).not.toContain("border-emerald");
    expect(card?.className).not.toContain("border-destructive");
  });

  it("warning variant applies amber border and background", () => {
    const { container } = render(
      <StatsCard title="Low Stock" value={3} variant="warning" />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain("border-amber-500");
    expect(card?.className).toContain("bg-amber-500/10");
  });

  it("success variant applies emerald border and background", () => {
    const { container } = render(
      <StatsCard title="All Clear" value={0} variant="success" />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain("border-emerald-500");
    expect(card?.className).toContain("bg-emerald-500/10");
  });

  it("danger variant applies destructive border and background", () => {
    const { container } = render(
      <StatsCard title="Out of Stock" value={7} variant="danger" />,
    );
    const card = container.firstElementChild;
    expect(card?.className).toContain("border-destructive");
    expect(card?.className).toContain("bg-destructive/10");
  });

  it("danger variant colours the value text destructive", () => {
    const { container } = render(
      <StatsCard title="Critical" value={7} variant="danger" />,
    );
    const valueEl = container.querySelector(".text-2xl");
    expect(valueEl?.className).toContain("text-destructive");
    expect(valueEl?.textContent).toBe("7");
  });

  it("non-danger variants do not colour the value text", () => {
    const variants = ["default", "warning", "success"] as const;
    for (const variant of variants) {
      const { container } = render(
        <StatsCard title="X" value={1} variant={variant} />,
      );
      const valueEl = container.querySelector(".text-2xl");
      expect(valueEl?.className).not.toContain("text-destructive");
    }
  });
});
