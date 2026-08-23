import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrivacyModal } from "@/components/common/PrivacyModal";

describe("PrivacyModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<PrivacyModal open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the privacy dialog with real-backend-accurate content when open", () => {
    render(<PrivacyModal open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Privacybeleid" })).toBeInTheDocument();
    expect(screen.getByText(/echte, beveiligde backend/)).toBeInTheDocument();
    expect(screen.getByText(/Account verwijderen/)).toBeInTheDocument();
  });
});
