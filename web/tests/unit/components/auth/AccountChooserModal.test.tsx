import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountChooserModal } from "@/components/auth/AccountChooserModal";

describe("AccountChooserModal", () => {
  it("invokes onChooseVisitor / onChooseBusiness / onClose", async () => {
    const onClose = vi.fn();
    const onChooseVisitor = vi.fn();
    const onChooseBusiness = vi.fn();
    const user = userEvent.setup();
    render(
      <AccountChooserModal
        open
        onClose={onClose}
        onChooseVisitor={onChooseVisitor}
        onChooseBusiness={onChooseBusiness}
      />,
    );

    await user.click(screen.getByText("👤 Ik ben bezoeker"));
    expect(onChooseVisitor).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("🎉 Ik ben Event Owner"));
    expect(onChooseBusiness).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
