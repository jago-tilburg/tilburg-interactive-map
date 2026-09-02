import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import PrivacybeleidPage from "@/app/privacybeleid/page";

describe("PrivacybeleidPage", () => {
  it("renders the policy with the data table, rights, and breach process", () => {
    render(<PrivacybeleidPage />);
    expect(screen.getByRole("heading", { name: "Privacybeleid" })).toBeInTheDocument();
    expect(screen.getAllByText(/Google Analytics/).length).toBeGreaterThan(0);
    expect(screen.getByText(/binnen 72 uur/)).toBeInTheDocument();
    expect(screen.getAllByText(/Autoriteit Persoonsgegevens/).length).toBeGreaterThan(0);
  });

  it("flags the missing company details as placeholders", () => {
    render(<PrivacybeleidPage />);
    expect(screen.getByText("[KVK-nummer]")).toBeInTheDocument();
  });
});
