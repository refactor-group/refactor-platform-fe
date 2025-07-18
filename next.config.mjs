/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	turbopack: {
		// Turbopack configuration options go here
	},
    webpack: (config) => {
		config.externals.push("@node-rs/argon2", "@node-rs/bcrypt");
		return config;
	}
};

export default nextConfig;
