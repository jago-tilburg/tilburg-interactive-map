import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { InitialSelection } from "@/components/map/MapExperience";

const receivedProps: { apiKey?: string; initialSelection?: InitialSelection }[] = [];
vi.mock("@/components/map/MapExperience", () => ({
  MapExperience: (props: { apiKey: string; initialSelection?: InitialSelection }) => {
    receivedProps.push(props);
    return <div data-testid="map-experience" />;
  },
}));

import { MapPageShell } from "@/app/_components/MapPageShell";

afterEach(() => {
  receivedProps.length = 0;
  vi.unstubAllEnvs();
});

describe("MapPageShell", () => {
  it("renders MapExperience with the API key and no initialSelection by default", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    render(<MapPageShell />);

    expect(screen.getByTestId("map-experience")).toBeInTheDocument();
    expect(receivedProps[0]).toEqual({ apiKey: "test-key", initialSelection: undefined });
  });

  it("passes initialSelection through to MapExperience", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "test-key");
    const initialSelection: InitialSelection = { type: "shop", id: 9001 };
    render(<MapPageShell initialSelection={initialSelection} />);

    expect(receivedProps[0]).toEqual({ apiKey: "test-key", initialSelection });
  });

  it("shows the missing-key message and never renders MapExperience when the API key isn't set", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    render(<MapPageShell />);

    expect(
      screen.getByText("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set — the map can't load."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-experience")).not.toBeInTheDocument();
  });
});
