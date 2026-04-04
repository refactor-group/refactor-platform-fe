/** @type {import('next').NextConfig} */
// PR preview: basePath for sub-path routing, containerized nginx for Docker DNS
const nextConfig = {
	output: 'standalone',
	basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
	// Version skew protection: when the server restarts with a new build,
	// Next.js detects the mismatch and triggers a hard reload instead of
	// serving stale RSC flight data to the old client JS.
	deploymentId: process.env.GIT_COMMIT_SHA || undefined,
	turbopack: {
		// Ensure Yjs is only loaded once to prevent duplicate instance warnings
		// See: https://github.com/yjs/yjs/issues/438
		resolveAlias: {
			yjs: 'yjs/dist/yjs.mjs',
		},
	},
};

export default nextConfig;
