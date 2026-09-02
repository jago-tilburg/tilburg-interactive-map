import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const hasCookieConsent = vi.fn();
const acceptNecessaryOnly = vi.fn();
const acceptAll = vi.fn();
vi.mock("@/lib/cookieConsent", () => ({
  hasCookieConsent: () => hasCookieConsent(),
  acceptNecessaryOnly: () => acceptNecessaryOnly(),
  acceptAll: () => acceptAll(),
}));

import { CookieBanner } from "@/components/common/CookieBanner";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CookieBanner", () => {
  it("shows the banner when consent has not been given", () => {
    hasCookieConsent.mockReturnValue(false);
    render(<CookieBanner />);
    expect(screen.getByRole("dialog", { name: "Cookiemelding" })).toBeInTheDocument();
  });

  it("renders nothing when consent was already given", () => {
    hasCookieConsent.mockReturnValue(true);
    const { container } = render(<CookieBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("accepts necessary-only cookies and hides the banner", async () => {
    hasCookieConsent.mockReturnValue(false);
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Alleen noodzakelijk"));

    expect(acceptNecessaryOnly).toHaveBeenCalled();
    expect(acceptAll).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Cookiemelding" })).not.toBeInTheDocument();
  });

  it("accepts all cookies (incl. analytics) and hides the banner", async () => {
    hasCookieConsent.mockReturnValue(false);
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Accepteren"));

    expect(acceptAll).toHaveBeenCalled();
    expect(acceptNecessaryOnly).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Cookiemelding" })).not.toBeInTheDocument();
  });

  it("opens and closes the privacy modal from 'Meer info'", async () => {
    hasCookieConsent.mockReturnValue(false);
    const user = userEvent.setup();
    render(<CookieBanner />);

    await user.click(screen.getByText("Meer info"));
    expect(screen.getByRole("dialog", { name: "Privacybeleid" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog", { name: "Privacybeleid" })).not.toBeInTheDocument();
  });
});
