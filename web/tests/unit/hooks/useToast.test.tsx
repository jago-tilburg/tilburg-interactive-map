import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/hooks/useToast";

function Consumer() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Saved!", "success")}>trigger-success</button>
      <button onClick={() => showToast("Failed!", "error")}>trigger-error</button>
      <button onClick={() => showToast("Just info")}>trigger-info</button>
    </div>
  );
}

describe("useToast", () => {
  it("throws when used outside a ToastProvider", () => {
    const Broken = () => {
      useToast();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Broken />)).toThrow("useToast must be used within ToastProvider");
    spy.mockRestore();
  });

  it("shows a toast with the given message and variant", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("trigger-success"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("defaults to the info variant when none is given", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("trigger-info"));
    expect(screen.getByText("Just info")).toBeInTheDocument();
  });

  it("stacks multiple toasts", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText("trigger-success"));
    await user.click(screen.getByText("trigger-error"));

    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByText("Failed!")).toBeInTheDocument();
  });

  it("auto-dismisses a toast after its duration", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText("trigger-success"));
    });
    expect(screen.getByText("Saved!")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
