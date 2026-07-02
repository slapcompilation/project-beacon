import type { Config } from 'tailwindcss'

// Blueprint (Palantir's design system) colour ramps — the exact intent + neutral
// hexes from @blueprintjs/colors. Core steps (400–700) are Blueprint's own
// values; the extreme tints/shades are derived in-ramp. We remap Tailwind's
// default (vivid) scales onto these so every raw `text-emerald-500`,
// `bg-amber-100`, etc. resolves to a Palantir colour — serious + muted — instead
// of Tailwind's rainbow. The decorative hues collapse into the four Blueprint
// intents + neutral (Blueprint has no purple, so violet/purple neutralise).
const bpBlue = {
  50: '#EAF1FB', 100: '#D2E2F7', 200: '#A9C7EF', 300: '#8ABBFF', 400: '#4C90F0',
  500: '#2D72D2', 600: '#215DB0', 700: '#184A90', 800: '#143C74', 900: '#102F5C', 950: '#0A1F3D',
}
const bpGreen = {
  50: '#E8F6EE', 100: '#C7E9D5', 200: '#96D6B4', 300: '#72CA9B', 400: '#32A467',
  500: '#238551', 600: '#1C6E42', 700: '#165A36', 800: '#114A2C', 900: '#0D3A22', 950: '#072615',
}
const bpOrange = {
  50: '#FDF3E7', 100: '#FAE1C4', 200: '#F6C88C', 300: '#FBB360', 400: '#EC9A3C',
  500: '#C87619', 600: '#935610', 700: '#77450D', 800: '#5E370A', 900: '#492B08', 950: '#2E1B05',
}
const bpRed = {
  50: '#FDECEC', 100: '#FAD1D2', 200: '#F5A8AA', 300: '#FA999C', 400: '#E76A6E',
  500: '#CD4246', 600: '#AC2F33', 700: '#8E292C', 800: '#74211F', 900: '#5C1A19', 950: '#3D110F',
}
const bpGray = {
  50: '#EDEFF2', 100: '#E5E8EB', 200: '#DCE0E5', 300: '#C5CBD3', 400: '#ABB3BF',
  500: '#8F99A8', 600: '#738091', 700: '#5F6B7C', 800: '#404854', 900: '#2F343C', 950: '#1C2127',
}

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Palantir/Blueprint palette — collapse Tailwind's rainbow into the four
        // Blueprint intents + neutral. Reserve saturated colour for meaning.
        blue: bpBlue, sky: bpBlue, cyan: bpBlue, indigo: bpBlue,
        green: bpGreen, emerald: bpGreen, teal: bpGreen, lime: bpGreen,
        orange: bpOrange, amber: bpOrange, yellow: bpOrange,
        red: bpRed, rose: bpRed, pink: bpRed, fuchsia: bpRed,
        violet: bpGray, purple: bpGray,
        slate: bpGray, gray: bpGray, zinc: bpGray, neutral: bpGray, stone: bpGray,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Palantir surface hierarchy — layered depth for panels */
        surface: {
          0: 'hsl(var(--surface-0, var(--background)))',
          1: 'hsl(var(--surface-1, var(--card)))',
          2: 'hsl(var(--surface-2, var(--popover)))',
          3: 'hsl(var(--surface-3, var(--accent)))',
        },
      },
      /* Blueprint rule: 4px everywhere. The size of the radius doesn't change
       * with the size of the component — Blueprint never goes rounder than 4px.
       * Keeps the same `rounded-lg` / `rounded-md` / `rounded-sm` API but they
       * all resolve to `var(--radius)` (= 4px). Predictable, operator-grade. */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius)',
        sm: 'var(--radius)',
      },
    },
  },
  plugins: [],
}

export default config
