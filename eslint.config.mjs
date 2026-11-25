import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Architecture rule: UI code may only use the public data-layer entry point "@/lib/data".
    // Fixtures and the in-memory implementation are PHASE 1 internals.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/data/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/data/fixtures", "@/lib/data/in-memory", "**/lib/data/fixtures", "**/lib/data/in-memory", "./fixtures", "./in-memory"],
              message: "Import from '@/lib/data' only. Fixtures/in-memory are Phase 1 internals.",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
