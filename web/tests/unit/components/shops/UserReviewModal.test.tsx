import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserReviewModal } from "@/components/shops/UserReviewModal";

describe("UserReviewModal", () => {
  it("marks name and text as required and blocks submission when empty", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<UserReviewModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Jouw naam")).toBeRequired();
    expect(screen.getByLabelText("Je review")).toBeRequired();

    await user.click(screen.getByText("Versturen"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed name/text and numeric rating", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<UserReviewModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Jouw naam"), " Jago ");
    await user.selectOptions(screen.getByLabelText("Beoordeling"), "9.0");
    await user.type(screen.getByLabelText("Je review"), " Top plek ");
    await user.click(screen.getByText("Versturen"));

    expect(onSubmit).toHaveBeenCalledWith({ name: "Jago", rating: 9.0, text: "Top plek" });
  });

  it("calls onClose on cancel", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UserReviewModal open onClose={onClose} onSubmit={vi.fn()} />);

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalled();
  });
});
