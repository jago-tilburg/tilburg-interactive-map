import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequestConfirmationModal } from "@/components/requests/RequestConfirmationModal";

describe("RequestConfirmationModal", () => {
  it("shows the thank-you message and closes on click", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RequestConfirmationModal open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Bedankt voor je suggestie!" })).toBeInTheDocument();
    await user.click(screen.getByText("Sluiten"));
    expect(onClose).toHaveBeenCalled();
  });
});
