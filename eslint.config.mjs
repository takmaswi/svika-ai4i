// Flat ESLint config for the whole monorepo. Framework-agnostic on purpose:
// typescript-eslint covers every workspace (Next, Vite, Node) with one ruleset,
// so CI lint stays fast and predictable. Framework build steps do their own
// deeper checks.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.d.ts",
      "Svika Design System/**",
      // Raw field data and vendor exports (ride logs, marker icon, design
      // system): inputs and third party code, never linted as source.
      "assets/**",
      // Isolated field tool: outside the pnpm workspace, own tsconfig/vitest.
      "tools/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
