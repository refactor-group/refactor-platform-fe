/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	turbopack: {
		// Ensure Yjs is only loaded once to prevent duplicate instance warnings
		// See: https://github.com/yjs/yjs/issues/438
		resolveAlias: {
			yjs: 'yjs/dist/yjs.mjs',
		},
	},
};

export default nextConfig;
