import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { PageHeader } from "@/components/common/PageHeader";

describe("PageHeader", () => {
  it("shows the brand and navigates to the map from the back link", async () => {
    const user = userEvent.setup();
    render(<PageHeader />);

    expect(screen.getByText("2happies")).toBeInTheDocument();

    await user.click(screen.getByText("← Naar de kaart"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });
});
