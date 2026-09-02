import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { LegalPage, Placeholder } from "@/components/legal/LegalPage";

describe("LegalPage", () => {
  it("renders the title, last-updated date, and children", () => {
    render(
      <LegalPage title="Test-titel" lastUpdated="1 januari 2026">
        <p>Test-inhoud</p>
      </LegalPage>,
    );
    expect(screen.getByRole("heading", { name: "Test-titel" })).toBeInTheDocument();
    expect(screen.getByText(/1 januari 2026/)).toBeInTheDocument();
    expect(screen.getByText("Test-inhoud")).toBeInTheDocument();
  });

  it("navigates back to the map", async () => {
    const user = userEvent.setup();
    render(
      <LegalPage title="Test-titel" lastUpdated="1 januari 2026">
        <p>Test-inhoud</p>
      </LegalPage>,
    );
    await user.click(screen.getByText("← Naar de kaart"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });
});

describe("Placeholder", () => {
  it("wraps its content in visible brackets", () => {
    render(<Placeholder>KVK-nummer</Placeholder>);
    expect(screen.getByText("[KVK-nummer]")).toBeInTheDocument();
  });
});
