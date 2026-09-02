import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const routerPush = vi.fn();
const routerReplace = vi.fn();
let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace }),
  useSearchParams: () => searchParamsValue,
}));

const subscribeMyBusinessEvents = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeMyBusinessEvents: (
    ...args: [string, (events: BusinessEvent[]) => void]
  ) => subscribeMyBusinessEvents(...args),
}));

const subscribeUmbrellaEvents = vi.fn();
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: (...args: [(umbrellas: never[]) => void]) => subscribeUmbrellaEvents(...args),
}));

vi.mock("@/components/auth/EmailVerifyNotice", () => ({
  EmailVerifyNotice: () => <div data-testid="verify-notice" />,
}));

// Each tab's own behavior is covered by its own test file — BusinessShell's
// job is orchestration (tab switching, URL sync, the shared editing/
// duplicate-from state), so the tabs are stubbed here.
vi.mock("@/components/business/InsightsTab", () => ({
  InsightsTab: ({
    events,
    onCreate,
    onEdit,
    onDuplicate,
  }: {
    events: BusinessEvent[];
    onCreate: () => void;
    onEdit: (ev: BusinessEvent) => void;
    onDuplicate: (ev: BusinessEvent) => void;
  }) => (
    <div data-testid="insights-tab">
      <span data-testid="event-count">{events.length}</span>
      <button onClick={onCreate}>insights-create</button>
      <button onClick={() => onEdit(events[0])}>insights-edit</button>
      <button onClick={() => onDuplicate(events[0])}>insights-duplicate</button>
    </div>
  ),
}));

vi.mock("@/components/business/NewEventTab", () => ({
  NewEventTab: ({
    active,
    editingEvent,
    duplicateFrom,
    onDone,
  }: {
    active: boolean;
    editingEvent: BusinessEvent | null;
    duplicateFrom: BusinessEvent | null;
    onDone: () => void;
  }) => (
    <div data-testid="new-event-tab">
      <span data-testid="new-active">{String(active)}</span>
      <span data-testid="new-editing">{editingEvent?.id ?? "none"}</span>
      <span data-testid="new-duplicating">{duplicateFrom?.id ?? "none"}</span>
      <button onClick={onDone}>new-done</button>
    </div>
  ),
}));

vi.mock("@/components/business/BusinessProfileTab", () => ({
  BusinessProfileTab: () => <div data-testid="profile-tab" />,
}));

import { BusinessShell } from "@/components/business/BusinessShell";

const business = { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null as never };
const event: BusinessEvent = {
  id: "evt1",
  title: "Test Event",
  category: "eten",
  description: "",
  startDate: "2026-09-01",
  endDate: "2026-09-01",
  startTime: "10:00",
  endTime: "18:00",
  address: "",
  lat: 0,
  lng: 0,
  ownerId: "u1",
  city: "Tilburg",
  status: "pending",
  paid: false,
  createdAt: null as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsValue = new URLSearchParams();
  subscribeMyBusinessEvents.mockImplementation((_uid, onChange) => {
    onChange([event]);
    return vi.fn();
  });
  subscribeUmbrellaEvents.mockImplementation((onChange) => {
    onChange([]);
    return vi.fn();
  });
});

describe("BusinessShell — guard", () => {
  it("renders nothing and redirects to the map when there is no business profile once loading finishes", () => {
    mockUseAuth.mockReturnValue({ currentBusiness: null, loading: false });
    const { container } = render(<BusinessShell />);
    expect(container).toBeEmptyDOMElement();
    expect(routerReplace).toHaveBeenCalledWith("/");
  });

  it("renders nothing (no redirect yet) while still loading", () => {
    mockUseAuth.mockReturnValue({ currentBusiness: null, loading: true });
    render(<BusinessShell />);
    expect(routerReplace).not.toHaveBeenCalledWith("/");
  });
});

describe("BusinessShell — signed in with a business", () => {
  function setup() {
    mockUseAuth.mockReturnValue({ currentBusiness: business, loading: false });
    return render(<BusinessShell />);
  }

  it("shows the brand, the back link, and the verification strip", () => {
    setup();
    expect(screen.getByText("2happies")).toBeInTheDocument();
    expect(screen.getByText("← Naar de kaart")).toBeInTheDocument();
    expect(screen.getByTestId("verify-notice")).toBeInTheDocument();
  });

  it("navigates to the map from the back link", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("← Naar de kaart"));
    expect(routerPush).toHaveBeenCalledWith("/");
  });

  it("defaults to the Inzicht tab and passes the subscribed events through", () => {
    setup();
    expect(screen.getByTestId("insights-tab")).toBeVisible();
    expect(screen.getByTestId("event-count")).toHaveTextContent("1");
  });

  it("starts on the tab named in ?tab=", () => {
    searchParamsValue = new URLSearchParams("tab=profiel");
    setup();
    expect(screen.getByTestId("profile-tab")).toBeVisible();
  });

  it("ignores an unrecognized ?tab= value and falls back to Inzicht", () => {
    searchParamsValue = new URLSearchParams("tab=nonsense");
    setup();
    expect(screen.getByTestId("insights-tab")).toBeVisible();
  });

  it("switches tabs and syncs the URL when a tab trigger is clicked", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("Profiel"));
    expect(routerReplace).toHaveBeenCalledWith("/eventbeheer?tab=profiel", { scroll: false });
  });

  it("opens the Nieuw-event tab in create mode from Insights' onCreate", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("insights-create"));
    expect(routerReplace).toHaveBeenCalledWith("/eventbeheer?tab=nieuw", { scroll: false });
    expect(screen.getByTestId("new-editing")).toHaveTextContent("none");
    expect(screen.getByTestId("new-duplicating")).toHaveTextContent("none");
  });

  it("opens the Nieuw-event tab pre-filled from Insights' onEdit", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("insights-edit"));
    expect(screen.getByTestId("new-editing")).toHaveTextContent("evt1");
    expect(screen.getByTestId("new-duplicating")).toHaveTextContent("none");
  });

  it("opens the Nieuw-event tab pre-filled from Insights' onDuplicate", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("insights-duplicate"));
    expect(screen.getByTestId("new-duplicating")).toHaveTextContent("evt1");
    expect(screen.getByTestId("new-editing")).toHaveTextContent("none");
  });

  it("returns to Inzicht and clears the editing/duplicate state when the form is done", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("insights-edit"));
    expect(screen.getByTestId("new-editing")).toHaveTextContent("evt1");

    await user.click(screen.getByText("new-done"));
    expect(routerReplace).toHaveBeenLastCalledWith("/eventbeheer?tab=inzicht", { scroll: false });
    expect(screen.getByTestId("insights-tab")).toBeVisible();

    // Reopening create mode afterward must not still show the old editingEvent.
    await user.click(screen.getByText("insights-create"));
    expect(screen.getByTestId("new-editing")).toHaveTextContent("none");
  });

  it("only mounts the Nieuw-event tab (and marks it active) once it's the selected tab — Radix Tabs unmounts inactive panels", async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByTestId("new-event-tab")).not.toBeInTheDocument();

    await user.click(screen.getByText("Nieuw event"));
    expect(screen.getByTestId("new-active")).toHaveTextContent("true");
  });
});
