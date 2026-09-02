import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

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

  it("navigates to the full policy page and closes the modal", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<PrivacyModal open onClose={onClose} />);

    await user.click(screen.getByText("Lees het volledige privacybeleid →"));

    expect(onClose).toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith("/privacybeleid");
  });
});
