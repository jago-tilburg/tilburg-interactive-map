import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormRow } from "@/components/common/FormRow";

describe("FormRow", () => {
  it("renders the label and value, and reveals children only after the row is clicked open", async () => {
    const user = userEvent.setup();
    render(
      <FormRow label="Locatie" value="Niet opgegeven">
        <input aria-label="Postcode" />
      </FormRow>,
    );

    expect(screen.getByText("Locatie")).toBeInTheDocument();
    expect(screen.getByText("Niet opgegeven")).toBeInTheDocument();
    expect(screen.queryByLabelText("Postcode")).not.toBeInTheDocument();

    await user.click(screen.getByText("Locatie"));
    expect(screen.getByLabelText("Postcode")).toBeInTheDocument();
  });

  it("closes again on a second click", async () => {
    const user = userEvent.setup();
    render(
      <FormRow label="Website" value="Niet opgegeven">
        <input aria-label="Website-URL" />
      </FormRow>,
    );

    const trigger = screen.getByText("Website");
    await user.click(trigger);
    expect(screen.getByLabelText("Website-URL")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByLabelText("Website-URL")).not.toBeInTheDocument();
  });

  it("renders children inline, with no chevron or expand behavior, when expandable is false", () => {
    render(
      <FormRow label="Categorie" expandable={false}>
        <select aria-label="Categorie">
          <option value="eten">🍔 Eten &amp; Drinken</option>
        </select>
      </FormRow>,
    );

    expect(screen.getByLabelText("Categorie")).toBeInTheDocument();
    expect(screen.queryByText("›")).not.toBeInTheDocument();
  });
});
