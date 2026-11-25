import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar, ScanBadge, StatusBadge } from "@/components/status";
import { clampPercent, formatBytes } from "@/lib/format";

describe("ProgressBar", () => {
  it.each([
    [-20, 0],
    [0, 0],
    [42.4, 42],
    [100, 100],
    [150, 100],
    [Number.NaN, 0],
  ])("clamps %s to %s", (input, expected) => {
    render(<ProgressBar value={input} label="Fortschritt" />);
    const bar = screen.getByRole("progressbar", { name: "Fortschritt" });
    expect(bar).toHaveAttribute("aria-valuenow", String(expected));
    expect(screen.getByTestId("progress-fill")).toHaveStyle({ width: `${expected}%` });
  });

  it("clampPercent always returns an integer in range", () => {
    expect(clampPercent(Infinity)).toBe(0);
    expect(clampPercent(99.6)).toBe(100);
  });
});

describe("StatusBadge", () => {
  it("renders the German label for pending", () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Freigabe ausstehend");
  });
  it("renders the German label for approved", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByTestId("status-badge")).toHaveTextContent("Freigegeben");
  });
});

describe("ScanBadge", () => {
  it.each([
    ["pending", "Scan wartet"],
    ["scanning", "Wird geprüft"],
    ["clean", "Virenfrei"],
    ["infected", "Quarantäne"],
    ["failed", "Scan fehlgeschlagen"],
  ] as const)("%s → %s", (status, label) => {
    render(<ScanBadge status={status} />);
    expect(screen.getByTestId("scan-badge")).toHaveTextContent(label);
  });
});

describe("formatBytes", () => {
  it("formats in German notation", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});
