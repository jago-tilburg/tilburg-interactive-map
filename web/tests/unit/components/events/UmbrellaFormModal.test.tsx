import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UmbrellaEvent } from "@/types/events";

const createUmbrellaEvent = vi.fn();
const updateUmbrellaEvent = vi.fn();
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  createUmbrellaEvent: (...args: unknown[]) => createUmbrellaEvent(...args),
  updateUmbrellaEvent: (...args: unknown[]) => updateUmbrellaEvent(...args),
}));

import { UmbrellaFormModal } from "@/components/events/UmbrellaFormModal";

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "Jaarlijkse kermis",
  color: "#b45309",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  createdAt: null as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  createUmbrellaEvent.mockResolvedValue(undefined);
  updateUmbrellaEvent.mockResolvedValue(undefined);
});

describe("UmbrellaFormModal create mode", () => {
  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={null} />);

    await user.click(screen.getByText("Opslaan"));
    expect(screen.getByText("Vul naam, startdatum en einddatum in")).toBeInTheDocument();
    expect(createUmbrellaEvent).not.toHaveBeenCalled();
  });

  it("creates a new umbrella event with every field filled in, and closes on success", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={onClose} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.clear(screen.getByLabelText("Startdatum"));
    await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.type(screen.getByLabelText("Omschrijving"), "Jaarlijkse kermis");
    await user.type(screen.getByLabelText("Foto-URL"), "https://example.com/kermis.jpg");
    // Native color inputs aren't reliably typeable via userEvent.type —
    // fire the change event RTL/React expects directly instead.
    fireEvent.change(screen.getByLabelText("Kleur"), { target: { value: "#123456" } });
    await user.click(screen.getByText("Opslaan"));

    expect(createUmbrellaEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Kermis 2026",
        startDate: "2026-09-01",
        description: "Jaarlijkse kermis",
        photoUrl: "https://example.com/kermis.jpg",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error message when saving fails", async () => {
    createUmbrellaEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt: network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while saving", async () => {
    createUmbrellaEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={onClose} editingUmbrella={null} />);

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("UmbrellaFormModal edit mode", () => {
  it("falls back to the default color when mounted directly with a colorless record", () => {
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={{ ...umbrella, color: "" }} />);
    expect(screen.getByLabelText("Kleur")).toHaveValue("#b45309");
  });

  it("pre-fills the form and updates on save", async () => {
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={umbrella} />);

    expect(screen.getByDisplayValue("Kermis")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Groot Tilburgs event bewerken" })).toBeInTheDocument();

    await user.click(screen.getByText("Opslaan"));
    expect(updateUmbrellaEvent).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "Kermis" }));
  });

  it("re-syncs the form when reopened for a different umbrella while still mounted", () => {
    const umbrellaWithoutColor: UmbrellaEvent = { ...umbrella, id: "u2", title: "Zonder kleur", color: "" };
    const { rerender } = render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={umbrella} />);
    expect(screen.getByDisplayValue("Kermis")).toBeInTheDocument();

    rerender(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={umbrellaWithoutColor} />);
    expect(screen.getByDisplayValue("Zonder kleur")).toBeInTheDocument();
    // Falls back to the default color when the record has none.
    expect(screen.getByLabelText("Kleur")).toHaveValue("#b45309");
  });
});
