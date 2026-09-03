import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import VoorwaardenPage from "@/app/voorwaarden/page";

describe("VoorwaardenPage", () => {
  it("renders the general and business terms with the €10 fee and refund policy", () => {
    render(<VoorwaardenPage />);
    expect(screen.getByRole("heading", { name: "Algemene voorwaarden" })).toBeInTheDocument();
    expect(screen.getByText(/€10/)).toBeInTheDocument();
    expect(screen.getByText(/geen restitutie/)).toBeInTheDocument();
    expect(screen.getByText(/16 jaar of ouder/)).toBeInTheDocument();
  });

  it("states the real company details, not placeholders", () => {
    render(<VoorwaardenPage />);
    expect(screen.getByText(/Bastiaanson/)).toBeInTheDocument();
    expect(screen.getByText(/65871421/)).toBeInTheDocument();
    expect(screen.getByText(/NL002308042B51/)).toBeInTheDocument();
    expect(screen.getAllByText(/2happies@bastiaanson\.com/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
  });
});
