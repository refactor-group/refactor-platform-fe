module.exports = {
  extends: "next/core-web-vitals",
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
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
  overrides: [
    {
      files: [
        "**/__tests__/**/*",
        "**/test-utils/**/*",
        "**/*.test.*",
        "**/*.spec.*",
      ],
      // Disable type-aware linting for test files since they're excluded from
      // tsconfig.json (to keep them out of production builds). This disables
      // ALL type-aware rules for tests, not just switch-exhaustiveness-check.
      parserOptions: {
        project: null,
      },
      rules: {
        "@typescript-eslint/switch-exhaustiveness-check": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
