/** @type {import('next').NextConfig} */
const nextConfig = {
	output: 'standalone',
	experimental: {
		turbo: {
		},
	  },
    webpack: (config) => {
		config.externals.push("@node-rs/argon2", "@node-rs/bcrypt");
		return config;
	}
};

export default nextConfig;
