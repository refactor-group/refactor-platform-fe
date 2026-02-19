import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "prototype/**",
    "next-env.d.ts",
    "postcss.config.js",
  ]),

  ...nextVitals,

  // Custom TypeScript rules (type-aware) - excludes test files
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "**/__tests__/**",
      "**/test-utils/**",
      "**/*.test.*",
      "**/*.spec.*",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Ensure all discriminated union variants are handled in switch statements
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // Flag unused variables (ignores variables prefixed with _)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Disable React Compiler rules added in eslint-config-next@16 that
  // weren't present in v15. These can be enabled incrementally as follow-up.
  // Placed last to ensure these overrides take effect after nextVitals rules.
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
