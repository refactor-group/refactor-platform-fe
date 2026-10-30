import type { Config } from "tailwindcss"

const { fontFamily } = require("tailwindcss/defaultTheme")

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))',
  				disabled: 'hsl(var(--primary-disabled))'
  			},
  			brand: {
  				DEFAULT: 'hsl(var(--brand))',
  				strong: 'hsl(var(--brand-strong))',
  				tint: 'hsl(var(--brand-tint))',
  				'tint-2': 'hsl(var(--brand-tint-2))',
  				border: 'hsl(var(--brand-border))',
  				dot: 'hsl(var(--brand-dot))',
  				month: 'hsl(var(--brand-month))'
  			},
  			'ink-2': 'hsl(var(--ink-2))',
  			faint: 'hsl(var(--faint))',
  			'disabled-icon': 'hsl(var(--disabled-icon))',
  			fill: {
  				DEFAULT: 'hsl(var(--fill))',
  				hover: 'hsl(var(--fill-hover))'
  			},
  			well: 'hsl(var(--well))',
  			hairline: 'hsl(var(--hairline))',
  			positive: {
  				DEFAULT: 'hsl(var(--positive))',
  				solid: 'hsl(var(--positive-solid))',
  				tint: 'hsl(var(--positive-tint))',
  				wash: 'hsl(var(--positive-wash))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				text: 'hsl(var(--warning-text))'
  			},
  			'on-hold': {
  				ring: 'hsl(var(--on-hold-ring))',
  				fill: 'hsl(var(--on-hold-fill))',
  				text: 'hsl(var(--on-hold-text))'
  			},
  			'status-idle': 'hsl(var(--status-idle))',
  			inverse: {
  				DEFAULT: 'hsl(var(--inverse))',
  				foreground: 'hsl(var(--inverse-foreground))'
  			},
  			'toast-check': 'hsl(var(--toast-check))',
  			avatar: {
  				DEFAULT: 'hsl(var(--avatar))',
  				foreground: 'hsl(var(--avatar-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			card: '16px',
  			popover: '14px',
  			input: '10px'
  		},
  		boxShadow: {
  			card: 'var(--shadow-card)',
  			popover: 'var(--shadow-popover)',
  			toast: 'var(--shadow-toast)'
  		},
  		backgroundImage: {
  			'hero-wash': 'var(--hero-wash)'
  		},
  		fontSize: {
  			'page-title': ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
  			headline: ['28px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
  			section: ['26px', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
  			'card-title': ['17px', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
  			item: ['13.5px', '1.4'],
  			label: ['12.5px', '1.4'],
  			pill: ['11.5px', '1.3'],
  			tiny: ['11px', '1.3']
  		},
  		transitionTimingFunction: {
  			spring: 'cubic-bezier(.2, .8, .2, 1)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'slide-in-from-left': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateX(-20px) scale(0.97)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateX(0) scale(1)'
  				}
  			},
  			'kanban-card-exit': {
  				'0%': {
  					opacity: '1',
  					transform: 'scale(1)',
  				},
  				'40%': {
  					opacity: '1',
  					transform: 'scale(1.03)',
  				},
  				'100%': {
  					opacity: '0',
  					transform: 'scale(0.85)',
  				}
  			},
  			'live-pulse': {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '.35'
  				}
  			},
  			'highlight-pulse': {
  				'0%, 100%': {
  					transform: 'scale(1)',
  				},
  				'35%': {
  					transform: 'scale(1.02)',
  				}
  			},
  			'highlight-tint': {
  				from: {
  					backgroundColor: 'var(--highlight-tint)',
  				},
  				to: {
  					backgroundColor: 'hsl(var(--background))',
  				}
  			},
  			'kanban-card-enter': {
  				'0%': {
  					opacity: '0',
  					transform: 'scale(0.85)',
  				},
  				'60%': {
  					opacity: '1',
  					transform: 'scale(1.03)',
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'scale(1)',
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'slide-in-from-left': 'slide-in-from-left 0.4s ease-out',
  			'kanban-card-exit': 'kanban-card-exit 350ms ease-in both',
  			'kanban-card-enter': 'kanban-card-enter 350ms ease-out both',
  			'live-pulse': 'live-pulse 2s ease-in-out infinite',
  			'highlight-pulse': 'highlight-pulse 600ms ease-out',
  			'highlight-tint': 'highlight-tint 2s ease-out both'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
                    ...fontFamily.sans
                ]
  		}
  	}
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config

export default config