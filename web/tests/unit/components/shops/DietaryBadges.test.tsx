import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DietaryBadges } from "@/components/shops/DietaryBadges";

describe("DietaryBadges", () => {
  it("renders nothing when options is undefined", () => {
    const { container } = render(<DietaryBadges options={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when no options are active", () => {
    const { container } = render(
      <DietaryBadges options={{ glutenvrij: false, halal: false, vega: false }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the active badges", () => {
    render(<DietaryBadges options={{ glutenvrij: true, halal: false, vega: true }} />);
    expect(screen.getByTitle("Glutenvrij")).toBeInTheDocument();
    expect(screen.getByTitle("Vega")).toBeInTheDocument();
    expect(screen.queryByTitle("Halal")).not.toBeInTheDocument();
  });
});
