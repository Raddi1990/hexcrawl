import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  // vite.config.js: local `tsc -b` output of vite.config.ts (gitignored), not source.
  { ignores: ["dist", "node_modules", "vite.config.js"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // TypeScript already reports undefined identifiers (and knows the DOM/Node
      // globals from tsconfig), so no-undef only produces false positives here.
      // Recommended by typescript-eslint.
      "no-undef": "off",
    },
  },
];
