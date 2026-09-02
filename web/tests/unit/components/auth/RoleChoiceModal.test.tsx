import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleChoiceModal } from "@/components/auth/RoleChoiceModal";

describe("RoleChoiceModal", () => {
  it("renders nothing when closed", () => {
    render(<RoleChoiceModal open={false} onClose={vi.fn()} onChoose={vi.fn()} onSkipToLogin={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onChoose('visitor') for the visitor option", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<RoleChoiceModal open onClose={vi.fn()} onChoose={onChoose} onSkipToLogin={vi.fn()} />);

    await user.click(screen.getByText("Ik ben bezoeker"));
    expect(onChoose).toHaveBeenCalledWith("visitor");
  });

  it("calls onChoose('business') for the event-host option", async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<RoleChoiceModal open onClose={vi.fn()} onChoose={onChoose} onSkipToLogin={vi.fn()} />);

    await user.click(screen.getByText("Ik ben event-host"));
    expect(onChoose).toHaveBeenCalledWith("business");
  });

  it("calls onSkipToLogin for the returning-user link", async () => {
    const onSkipToLogin = vi.fn();
    const user = userEvent.setup();
    render(<RoleChoiceModal open onClose={vi.fn()} onChoose={vi.fn()} onSkipToLogin={onSkipToLogin} />);

    await user.click(screen.getByText("Ik heb al een account, inloggen"));
    expect(onSkipToLogin).toHaveBeenCalled();
  });

  it("closes via the Modal's own close affordance", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RoleChoiceModal open onClose={onClose} onChoose={vi.fn()} onSkipToLogin={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Sluiten" }));
    expect(onClose).toHaveBeenCalled();
  });
});
