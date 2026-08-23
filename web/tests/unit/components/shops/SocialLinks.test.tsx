import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/analytics/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

import { SocialLinks } from "@/components/shops/SocialLinks";
import { trackEvent } from "@/lib/analytics/trackEvent";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SocialLinks", () => {
  it("renders nothing when neither url is set", () => {
    const { container } = render(<SocialLinks shopName="Test Shop" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the tiktok link when only tiktokUrl is set", () => {
    render(<SocialLinks shopName="Test Shop" tiktokUrl="https://tiktok.com/@test" />);
    expect(screen.getByTitle("TikTok")).toBeInTheDocument();
    expect(screen.queryByTitle("Instagram")).not.toBeInTheDocument();
  });

  it("tracks a click_social_link event with the platform on click", async () => {
    const user = userEvent.setup();
    render(<SocialLinks shopName="Test Shop" instagramUrl="https://instagram.com/test" />);

    await user.click(screen.getByTitle("Instagram"));
    expect(trackEvent).toHaveBeenCalledWith("click_social_link", {
      shop_name: "Test Shop",
      platform: "instagram",
    });
  });

  it("tracks a click_social_link event for tiktok on click", async () => {
    const user = userEvent.setup();
    render(<SocialLinks shopName="Test Shop" tiktokUrl="https://tiktok.com/@test" />);

    await user.click(screen.getByTitle("TikTok"));
    expect(trackEvent).toHaveBeenCalledWith("click_social_link", {
      shop_name: "Test Shop",
      platform: "tiktok",
    });
  });
});
