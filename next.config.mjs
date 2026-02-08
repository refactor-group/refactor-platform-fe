/** @type {import('next').NextConfig} */
// PR preview: basePath for sub-path routing, containerized nginx for Docker DNS
const nextConfig = {
	output: 'standalone',
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
	turbopack: {
		// Turbopack configuration options go here
	},
    webpack: (config) => {
		config.externals.push("@node-rs/argon2", "@node-rs/bcrypt");

		// Ensure Yjs is only loaded once to prevent duplicate instance warnings
		// See: https://github.com/yjs/yjs/issues/438
		config.resolve.alias = {
			...config.resolve.alias,
			yjs: new URL('node_modules/yjs/dist/yjs.mjs', import.meta.url).pathname
		};

		return config;
	}
};

export default nextConfig;
