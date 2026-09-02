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

  it("flags the missing company details as placeholders", () => {
    render(<VoorwaardenPage />);
    expect(screen.getByText("[KVK-nummer]")).toBeInTheDocument();
    expect(screen.getByText("[BTW-nummer]")).toBeInTheDocument();
  });
});
