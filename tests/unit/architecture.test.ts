import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { PortalDataSource } from "@/lib/data";

const SRC = join(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("architecture", () => {
  const files = walk(SRC).filter((f) => !relative(SRC, f).startsWith(join("lib", "data")));

  it("no UI file imports fixtures or the in-memory implementation", () => {
    const offenders = files.filter((f) => /from\s+["'][^"']*(lib\/data\/(fixtures|in-memory))["']/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("fixture data lives only in fixtures.ts", () => {
    const dataDir = walk(join(SRC, "lib", "data"));
    const withFixtureEmails = dataDir.filter((f) => /@(example|muster-gmbh|beispiel-ag)\.test/.test(readFileSync(f, "utf8")));
    expect(withFixtureEmails.map((f) => relative(SRC, f))).toEqual([join("lib", "data", "fixtures.ts")]);
  });

  it("fixtures and in-memory files carry the PHASE 1 ONLY marker", () => {
    for (const name of ["fixtures.ts", "in-memory.ts"]) {
      expect(readFileSync(join(SRC, "lib", "data", name), "utf8")).toContain("PHASE 1 ONLY");
    }
  });

  it("the contract contains every method required by brief, addendum and kickoff", () => {
    const required: (keyof PortalDataSource)[] = [
      "listProjectsForUser", "getProject", "createProject", "updateProject", "setProgress", "listFiles",
      "requestUploadUrl", "confirmUpload", "approveFile", "revertFile", "deleteFile", "listMembers",
      "inviteMember", "getDownloadUrl", "listFileVersions", "archiveProject", "requestClientDeletion",
      "enrollMfa", "verifyMfa", "getRetentionPolicy", "touchSession",
    ];
    const src = readFileSync(join(SRC, "lib", "data", "contract.ts"), "utf8");
    for (const m of required) expect(src, m).toMatch(new RegExp(`\\b${m}\\(`));
  });
});
