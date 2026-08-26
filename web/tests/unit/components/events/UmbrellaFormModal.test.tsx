import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UmbrellaEvent } from "@/types/events";
import type { PendingPhoto } from "@/components/common/PhotoUploadField";

const createUmbrellaEvent = vi.fn();
const updateUmbrellaEvent = vi.fn();
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  createUmbrellaEvent: (...args: unknown[]) => createUmbrellaEvent(...args),
  updateUmbrellaEvent: (...args: unknown[]) => updateUmbrellaEvent(...args),
}));

const resolvePhotoUpdate = vi.fn();
vi.mock("@/lib/photos/resolvePhotoUpdate", () => ({
  resolvePhotoUpdate: (...a: unknown[]) => resolvePhotoUpdate(...a),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

// See ShopFormModal.test.tsx for why PhotoUploadField is faked down to just
// its two triggering buttons here — its own pipeline is covered by its
// dedicated test file.
vi.mock("@/components/common/PhotoUploadField", () => ({
  PhotoUploadField: ({
    onPendingPhotoChange,
  }: {
    onPendingPhotoChange: (p: PendingPhoto | null) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onPendingPhotoChange({ action: "replace", blob: new Blob(["x"]), previewUrl: "blob:preview" })}
      >
        FakeSelectPhoto
      </button>
      <button type="button" onClick={() => onPendingPhotoChange({ action: "remove" })}>
        FakeRemovePhoto
      </button>
    </div>
  ),
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
  createUmbrellaEvent.mockResolvedValue({ id: "u1" });
  updateUmbrellaEvent.mockResolvedValue(undefined);
  resolvePhotoUpdate.mockResolvedValue("");
});

describe("UmbrellaFormModal create mode", () => {
  it("marks title, start date, and end date as required and blocks submission when empty", async () => {
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={null} />);

    expect(screen.getByLabelText("Naam")).toBeRequired();
    expect(screen.getByLabelText("Startdatum")).toBeRequired();
    expect(screen.getByLabelText("Einddatum")).toBeRequired();

    await user.click(screen.getByText("Opslaan"));
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
    // Native color inputs aren't reliably typeable via userEvent.type —
    // fire the change event RTL/React expects directly instead.
    fireEvent.change(screen.getByLabelText("Kleur"), { target: { value: "#123456" } });
    await user.click(screen.getByText("Opslaan"));

    expect(createUmbrellaEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Kermis 2026",
        startDate: "2026-09-01",
        description: "Jaarlijkse kermis",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("uploads the photo after create and attaches its URL, once the new umbrella's id is known", async () => {
    resolvePhotoUpdate.mockResolvedValue("https://storage.example/umbrellaEvents/u1/abc.webp");
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={onClose} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(createUmbrellaEvent).toHaveBeenCalledWith(expect.objectContaining({ photoUrl: "" }));
    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "umbrellaEvents",
      "u1",
      expect.objectContaining({ action: "replace" }),
      "",
    );
    expect(updateUmbrellaEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ photoUrl: "https://storage.example/umbrellaEvents/u1/abc.webp" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("skips the extra photoUrl write when the resolved photo is empty (picked then removed before ever saving)", async () => {
    resolvePhotoUpdate.mockResolvedValue("");
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.click(screen.getByText("FakeRemovePhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(updateUmbrellaEvent).not.toHaveBeenCalled();
  });

  it("shows a toast and still closes when the photo upload fails after a successful create (record is already saved)", async () => {
    resolvePhotoUpdate.mockRejectedValue(new Error("upload failed"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={onClose} editingUmbrella={null} />);

    await user.type(screen.getByLabelText("Naam"), "Kermis 2026");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-10");
    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(updateUmbrellaEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Groot evenement opgeslagen, maar foto uploaden is mislukt. Voeg de foto later toe via bewerken.",
      "error",
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

  it("replaces the photo on save, resolving the new URL via the umbrella's existing id", async () => {
    const withPhoto = { ...umbrella, photoUrl: "https://storage.example/umbrellaEvents/u1/old.webp" };
    resolvePhotoUpdate.mockResolvedValue("https://storage.example/umbrellaEvents/u1/new.webp");
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={withPhoto} />);

    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "umbrellaEvents",
      "u1",
      expect.objectContaining({ action: "replace" }),
      "https://storage.example/umbrellaEvents/u1/old.webp",
    );
    expect(updateUmbrellaEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ photoUrl: "https://storage.example/umbrellaEvents/u1/new.webp" }),
    );
  });

  it("removes the photo on save, setting photoUrl to empty", async () => {
    const withPhoto = { ...umbrella, photoUrl: "https://storage.example/umbrellaEvents/u1/old.webp" };
    resolvePhotoUpdate.mockResolvedValue("");
    const user = userEvent.setup();
    render(<UmbrellaFormModal open onClose={vi.fn()} editingUmbrella={withPhoto} />);

    await user.click(screen.getByText("FakeRemovePhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "umbrellaEvents",
      "u1",
      expect.objectContaining({ action: "remove" }),
      "https://storage.example/umbrellaEvents/u1/old.webp",
    );
    expect(updateUmbrellaEvent).toHaveBeenCalledWith("u1", expect.objectContaining({ photoUrl: "" }));
  });
});
