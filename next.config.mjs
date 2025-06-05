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

// Print environment variables at startup
console.log('=== Environment Variables ===')
Object.keys(process.env)
  .filter(key => key.startsWith('NEXT_PUBLIC_'))
  .sort()
  .forEach(key => {
    console.log(`${key}: ${process.env[key]}`)
  })
console.log('=============================')

export default nextConfig;
