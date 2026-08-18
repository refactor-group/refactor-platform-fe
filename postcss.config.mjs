// ESM, matching the other configs here; the CommonJS form tripped a Turbopack
// interop bug on cold builds, fixed upstream in Next 16.3.1.
const config = {
  plugins: {
    'postcss-import': {},
    tailwindcss: {},
    'postcss-nested': {},
    autoprefixer: {},
  },
};

export default config;
