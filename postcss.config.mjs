// ESM, matching every other config in this repo (next.config.mjs,
// eslint.config.mjs, vitest.config.mts, tailwind.config.ts). As CommonJS this
// was the one config Turbopack had to wrap for interop, and that wrapper
// intermittently failed a cold `next build` with
// `TypeError: __turbopack_context__.a is not a function`.
const config = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    'postcss-nested': {},
    autoprefixer: {},
  },
};

export default config;
