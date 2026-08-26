import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/common/Modal";

describe("Modal", () => {
  it("moves focus into the dialog when opened", () => {
    render(
      <Modal open onClose={vi.fn()} title="Test">
        body
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Test">
        body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the trigger element after closing", async () => {
    function Wrapper() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Modal open={open} onClose={() => setOpen(false)} title="Test">
            body
          </Modal>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Wrapper />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Test">
        content
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title and children when open", () => {
    render(
      <Modal open onClose={vi.fn()} title="Test title">
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Test title" })).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("calls onClose when the overlay is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Test">
        body
      </Modal>,
    );
    await user.click(screen.getByRole("presentation", { hidden: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the dialog body is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Test">
        body
      </Modal>,
    );
    await user.click(screen.getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Test">
        body
      </Modal>,
    );
    await user.click(screen.getByLabelText("Sluiten"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("swipe-to-close", () => {
    function header() {
      return screen.getByRole("heading", { name: "Test" }).parentElement!;
    }

    it("closes when dragged down past the threshold", () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="Test">
          body
        </Modal>,
      );

      fireEvent.touchStart(header(), { touches: [{ clientX: 0, clientY: 100 }], changedTouches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(header(), { touches: [{ clientX: 0, clientY: 250 }], changedTouches: [{ clientX: 0, clientY: 250 }] });
      fireEvent.touchEnd(header(), { changedTouches: [{ clientX: 0, clientY: 0 }] });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("snaps back without closing when dragged down less than the threshold", () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="Test">
          body
        </Modal>,
      );

      fireEvent.touchStart(header(), { touches: [{ clientX: 0, clientY: 100 }], changedTouches: [{ clientX: 0, clientY: 100 }] });
      fireEvent.touchMove(header(), { touches: [{ clientX: 0, clientY: 150 }], changedTouches: [{ clientX: 0, clientY: 150 }] });
      fireEvent.touchEnd(header(), { changedTouches: [{ clientX: 0, clientY: 0 }] });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores an upward drag", () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="Test">
          body
        </Modal>,
      );

      fireEvent.touchStart(header(), { touches: [{ clientX: 0, clientY: 200 }], changedTouches: [{ clientX: 0, clientY: 200 }] });
      fireEvent.touchMove(header(), { touches: [{ clientX: 0, clientY: 50 }], changedTouches: [{ clientX: 0, clientY: 50 }] });
      fireEvent.touchEnd(header(), { changedTouches: [{ clientX: 0, clientY: 0 }] });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("ignores a touchmove with no preceding touchstart", () => {
      const onClose = vi.fn();
      render(
        <Modal open onClose={onClose} title="Test">
          body
        </Modal>,
      );

      fireEvent.touchMove(header(), { touches: [{ clientX: 0, clientY: 250 }], changedTouches: [{ clientX: 0, clientY: 250 }] });
      fireEvent.touchEnd(header(), { changedTouches: [{ clientX: 0, clientY: 0 }] });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
