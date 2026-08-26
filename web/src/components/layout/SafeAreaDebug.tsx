"use client";

import { useEffect, useState } from "react";

// TEMPORARY diagnostic overlay for the header/notch investigation
// (2026-08-26) — remove once resolved. Renders real env(safe-area-inset-*)
// values, viewport dimensions, and UA directly on screen so they can be
// read from a phone screenshot instead of guessed at blind.
export function SafeAreaDebug() {
  const [info, setInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.top = "0";
    probe.style.left = "-9999px";
    probe.style.paddingTop = "env(safe-area-inset-top, -1px)";
    probe.style.paddingBottom = "env(safe-area-inset-bottom, -1px)";
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    const safeTop = computed.paddingTop;
    const safeBottom = computed.paddingBottom;
    document.body.removeChild(probe);

    const viewportMeta = document.querySelector('meta[name="viewport"]');

    setInfo({
      "env(safe-area-inset-top)": safeTop,
      "env(safe-area-inset-bottom)": safeBottom,
      "viewport meta content": viewportMeta?.getAttribute("content") ?? "MISSING",
      "window.innerWidth x innerHeight": `${window.innerWidth} x ${window.innerHeight}`,
      "visualViewport w x h": window.visualViewport
        ? `${window.visualViewport.width} x ${window.visualViewport.height}`
        : "unavailable",
      "screen w x h": `${window.screen.width} x ${window.screen.height}`,
      devicePixelRatio: String(window.devicePixelRatio),
      "document.documentElement clientWidth x clientHeight": `${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`,
      userAgent: navigator.userAgent,
      standalone: String((navigator as unknown as { standalone?: boolean }).standalone ?? "n/a"),
    });
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "black",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: "11px",
        padding: "8px",
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {Object.entries(info).map(([k, v]) => (
        <div key={k}>
          <strong>{k}:</strong> {v}
        </div>
      ))}
    </div>
  );
}
