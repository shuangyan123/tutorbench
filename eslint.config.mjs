import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "services/community-review-service/dist/**",
      "node_modules/**",
      "coverage/**",
      "results/**",
      "artifacts/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "examples/**/*.mjs"],
    languageOptions: {
      globals: {
        AbortController: "readonly",
        Buffer: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        performance: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    files: ["tools/premium-dashboard/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        Blob: "readonly",
        document: "readonly",
        history: "readonly",
        localStorage: "readonly",
        location: "readonly",
        navigator: "readonly",
        Node: "readonly",
        setTimeout: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
        window: "readonly",
      },
    },
  },
  {
    files: ["tools/premium-dashboard/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        TextDecoder: "readonly",
      },
    },
  },
);
