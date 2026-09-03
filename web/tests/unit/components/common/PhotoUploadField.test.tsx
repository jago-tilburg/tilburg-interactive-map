import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const isHeic = vi.fn();
const convertHeicToJpeg = vi.fn();
vi.mock("@/lib/photos/heicConvert", () => ({
  isHeic: (...a: unknown[]) => isHeic(...a),
  convertHeicToJpeg: (...a: unknown[]) => convertHeicToJpeg(...a),
}));

const validatePhotoFile = vi.fn();
const loadImageDimensions = vi.fn();
const isLargeEnough = vi.fn();
vi.mock("@/lib/photos/imageFile", () => ({
  validatePhotoFile: (...a: unknown[]) => validatePhotoFile(...a),
  loadImageDimensions: (...a: unknown[]) => loadImageDimensions(...a),
  isLargeEnough: (...a: unknown[]) => isLargeEnough(...a),
}));

const cropToWebp = vi.fn();
vi.mock("@/lib/photos/cropToWebp", () => ({
  cropToWebp: (...a: unknown[]) => cropToWebp(...a),
}));

// A minimal fake <Cropper> that renders a button to trigger onCropComplete
// with a fixed pixel rect — the real crop-drag UI is react-easy-crop's own
// responsibility, not this app's; only the wiring around it is ours to test.
vi.mock("react-easy-crop", () => ({
  default: ({ onCropComplete }: { onCropComplete: (area: unknown, areaPixels: unknown) => void }) => (
    <button type="button" onClick={() => onCropComplete({}, { x: 1, y: 2, width: 300, height: 300 })}>
      FakeCropperReady
    </button>
  ),
}));

import { PhotoUploadField, type PendingPhoto } from "@/components/common/PhotoUploadField";

let createObjectURLCounter = 0;
const revokeObjectURL = vi.fn();

function makeFile(name = "photo.jpg", type = "image/jpeg") {
  return new File(["fake-bytes"], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  isHeic.mockReturnValue(false);
  validatePhotoFile.mockReturnValue(null);
  loadImageDimensions.mockResolvedValue({ width: 1200, height: 800 });
  isLargeEnough.mockReturnValue(true);
  cropToWebp.mockResolvedValue(new Blob(["cropped"], { type: "image/webp" }));
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => `blob:fake-${++createObjectURLCounter}`),
    revokeObjectURL,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderField(overrides: Partial<Parameters<typeof PhotoUploadField>[0]> = {}) {
  const onPendingPhotoChange = vi.fn();
  const utils = render(
    <PhotoUploadField
      label="Foto"
      hint="Kies een liggende foto (16:9)."
      aspectRatio={16 / 9}
      currentUrl=""
      pendingPhoto={null}
      onPendingPhotoChange={onPendingPhotoChange}
      {...overrides}
    />,
  );
  return { ...utils, onPendingPhotoChange };
}

describe("PhotoUploadField — idle state", () => {
  it("shows the hint and a picker button, no preview, when there's no current photo and no pending change", () => {
    renderField();
    expect(screen.getByText("Kies een liggende foto (16:9).")).toBeInTheDocument();
    expect(screen.getByText("Foto kiezen")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("Verwijderen")).not.toBeInTheDocument();
  });

  it("shows the current photo and a remove button when one already exists", () => {
    renderField({ currentUrl: "https://storage.example/shops/1/existing.webp" });
    const img = screen.getByRole("img", { name: "Foto" });
    expect(img).toHaveAttribute("src", "https://storage.example/shops/1/existing.webp");
    expect(screen.getByText("Andere foto kiezen")).toBeInTheDocument();
    expect(screen.getByText("Verwijderen")).toBeInTheDocument();
  });
});

describe("PhotoUploadField — file selection and validation", () => {
  it("shows a validation error and never enters the crop stage for an invalid file", async () => {
    validatePhotoFile.mockReturnValue("Ongeldig bestandstype. Gebruik JPEG, PNG, WebP of HEIC.");
    const user = userEvent.setup();
    renderField();

    // userEvent.upload respects the input's accept attribute and silently
    // drops a mismatched file, so this uses an accepted MIME type — the
    // rejection itself comes from the mocked validatePhotoFile above, same
    // as it would for e.g. an oversized JPEG.
    await user.upload(screen.getByLabelText("Foto"), makeFile("photo.jpg", "image/jpeg"));

    expect(await screen.findByText("Ongeldig bestandstype. Gebruik JPEG, PNG, WebP of HEIC.")).toBeInTheDocument();
    expect(screen.queryByText("FakeCropperReady")).not.toBeInTheDocument();
  });

  it("rejects a source image below the minimum dimensions before cropping", async () => {
    isLargeEnough.mockReturnValue(false);
    const user = userEvent.setup();
    renderField();

    await user.upload(screen.getByLabelText("Foto"), makeFile());

    expect(await screen.findByText("Foto is te klein (minimaal 480×480 pixels).")).toBeInTheDocument();
    expect(screen.queryByText("FakeCropperReady")).not.toBeInTheDocument();
  });

  it("converts a HEIC file before measuring/cropping it", async () => {
    isHeic.mockReturnValue(true);
    const jpegBlob = new Blob(["jpeg"], { type: "image/jpeg" });
    convertHeicToJpeg.mockResolvedValue(jpegBlob);
    const user = userEvent.setup();
    renderField();

    await user.upload(screen.getByLabelText("Foto"), makeFile("photo.heic", "image/heic"));

    await waitFor(() => expect(convertHeicToJpeg).toHaveBeenCalled());
    expect(await screen.findByText("FakeCropperReady")).toBeInTheDocument();
  });

  it("enters the crop stage for a valid, large-enough file", async () => {
    const user = userEvent.setup();
    renderField();

    await user.upload(screen.getByLabelText("Foto"), makeFile());

    expect(await screen.findByText("FakeCropperReady")).toBeInTheDocument();
    expect(convertHeicToJpeg).not.toHaveBeenCalled();
  });

  it("shows a generic error message when dimension-loading itself throws", async () => {
    loadImageDimensions.mockRejectedValue(new Error("could not decode"));
    const user = userEvent.setup();
    renderField();

    await user.upload(screen.getByLabelText("Foto"), makeFile());

    expect(await screen.findByText("could not decode")).toBeInTheDocument();
  });
});

describe("PhotoUploadField — crop confirm/cancel", () => {
  async function selectAndReachCropStage(user: ReturnType<typeof userEvent.setup>) {
    await user.upload(screen.getByLabelText("Foto"), makeFile());
    await screen.findByText("FakeCropperReady");
  }

  it("confirming the crop reports a replace action with the compressed blob to the parent", async () => {
    const croppedBlob = new Blob(["cropped"], { type: "image/webp" });
    cropToWebp.mockResolvedValue(croppedBlob);
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField();

    await selectAndReachCropStage(user);
    await user.click(screen.getByText("FakeCropperReady"));
    await user.click(screen.getByText("Bijsnijden bevestigen"));

    await waitFor(() =>
      expect(onPendingPhotoChange).toHaveBeenCalledWith({
        action: "replace",
        blob: croppedBlob,
        previewUrl: expect.stringMatching(/^blob:fake-/),
      }),
    );
    // Back to idle state, not the crop stage.
    expect(screen.queryByText("FakeCropperReady")).not.toBeInTheDocument();
  });

  it("does nothing if 'confirm' is clicked before the crop area is ready (button stays disabled)", async () => {
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField();

    await selectAndReachCropStage(user);
    expect(screen.getByText("Bijsnijden bevestigen")).toBeDisabled();
    expect(onPendingPhotoChange).not.toHaveBeenCalled();
  });

  it("cancelling the crop returns to the idle state without reporting anything", async () => {
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField();

    await selectAndReachCropStage(user);
    await user.click(screen.getByText("Annuleren"));

    expect(screen.queryByText("FakeCropperReady")).not.toBeInTheDocument();
    expect(onPendingPhotoChange).not.toHaveBeenCalled();
  });

  it("shows an error and stays available for retry when compression fails", async () => {
    cropToWebp.mockRejectedValue(new Error("Foto comprimeren is mislukt."));
    const user = userEvent.setup();
    renderField();

    await selectAndReachCropStage(user);
    await user.click(screen.getByText("FakeCropperReady"));
    await user.click(screen.getByText("Bijsnijden bevestigen"));

    expect(await screen.findByText("Foto comprimeren is mislukt.")).toBeInTheDocument();
  });

  it("revokes the previous preview object URL when replacing an already-pending replacement", async () => {
    const existingPending: PendingPhoto = { action: "replace", blob: new Blob(["old"]), previewUrl: "blob:old-preview" };
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField({ pendingPhoto: existingPending });

    await selectAndReachCropStage(user);
    await user.click(screen.getByText("FakeCropperReady"));
    await user.click(screen.getByText("Bijsnijden bevestigen"));

    await waitFor(() => expect(onPendingPhotoChange).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:old-preview");
  });
});

describe("PhotoUploadField — remove/undo", () => {
  it("clicking remove reports a remove action", async () => {
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField({ currentUrl: "https://storage.example/shops/1/existing.webp" });

    await user.click(screen.getByText("Verwijderen"));

    expect(onPendingPhotoChange).toHaveBeenCalledWith({ action: "remove" });
  });

  it("revokes a pending replacement's preview URL when removed instead", async () => {
    const pending: PendingPhoto = { action: "replace", blob: new Blob(["x"]), previewUrl: "blob:pending-preview" };
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField({ pendingPhoto: pending });

    await user.click(screen.getByText("Verwijderen"));

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pending-preview");
    expect(onPendingPhotoChange).toHaveBeenCalledWith({ action: "remove" });
  });

  it("shows an undo button after removing, which clears the pending action", async () => {
    const user = userEvent.setup();
    const { onPendingPhotoChange } = renderField({
      currentUrl: "https://storage.example/shops/1/existing.webp",
      pendingPhoto: { action: "remove" },
    });

    expect(screen.getByText("Ongedaan maken")).toBeInTheDocument();
    await user.click(screen.getByText("Ongedaan maken"));

    expect(onPendingPhotoChange).toHaveBeenCalledWith(null);
  });
});

describe("PhotoUploadField — disabled state", () => {
  it("disables the picker/remove buttons when disabled", () => {
    renderField({ currentUrl: "https://storage.example/shops/1/existing.webp", disabled: true });

    expect(screen.getByText("Andere foto kiezen")).toBeDisabled();
    expect(screen.getByText("Verwijderen")).toBeDisabled();
  });
});
