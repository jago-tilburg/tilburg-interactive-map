import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "@/lib/safeUrl";

describe("isSafeHttpUrl", () => {
  it("allows http/https URLs", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/page?x=1")).toBe(true);
  });

  it("rejects javascript: URIs", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false);
  });

  it("rejects data: URIs", () => {
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects vbscript: and other exotic schemes", () => {
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeHttpUrl("not a url at all")).toBe(false);
  });

  it("rejects undefined/null/empty", () => {
    expect(isSafeHttpUrl(undefined)).toBe(false);
    expect(isSafeHttpUrl(null)).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });
});
