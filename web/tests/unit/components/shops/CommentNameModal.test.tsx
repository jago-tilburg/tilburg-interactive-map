import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentNameModal } from "@/components/shops/CommentNameModal";

describe("CommentNameModal", () => {
  it("marks the name field as required and blocks submission when empty", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<CommentNameModal open onCancel={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("Jouw naam")).toBeRequired();

    await user.click(screen.getByText("Versturen"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the trimmed name", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<CommentNameModal open onCancel={vi.fn()} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Jouw naam"), "  Jago  ");
    await user.click(screen.getByText("Versturen"));

    expect(onSubmit).toHaveBeenCalledWith("Jago");
  });

  it("calls onCancel and resets on cancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<CommentNameModal open onCancel={onCancel} onSubmit={vi.fn()} />);

    await user.click(screen.getByText("Annuleren"));
    expect(onCancel).toHaveBeenCalled();
  });
});
