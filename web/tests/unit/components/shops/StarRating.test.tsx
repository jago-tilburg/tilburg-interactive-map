import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarRating } from "@/components/shops/StarRating";

describe("StarRating", () => {
  it("shows the hint when the user hasn't rated yet", () => {
    render(<StarRating currentUserRating={undefined} onRate={vi.fn()} />);
    expect(screen.getByText("Klik op de sterren om te beoordelen")).toBeInTheDocument();
  });

  it("shows confirmation with the user's rating once rated", () => {
    render(<StarRating currentUserRating={7} onRate={vi.fn()} />);
    expect(screen.getByText("✓ Je gaf 7 sterren")).toBeInTheDocument();
  });

  it("calls onRate with the clicked star value", async () => {
    const onRate = vi.fn();
    const user = userEvent.setup();
    render(<StarRating currentUserRating={undefined} onRate={onRate} />);

    await user.click(screen.getByLabelText("Geef 8 sterren"));
    expect(onRate).toHaveBeenCalledWith(8);
  });

  it("renders exactly 10 star buttons", () => {
    render(<StarRating currentUserRating={undefined} onRate={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(10);
  });
});
