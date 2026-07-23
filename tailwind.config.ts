import type { Config } from "tailwindcss";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--accent)",
        background: "var(--bg-0)",
        foreground: "var(--text-1)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-on)",
        },
        secondary: {
          DEFAULT: "var(--bg-3)",
          foreground: "var(--text-1)",
        },
        destructive: {
          DEFAULT: "var(--danger)",
          foreground: "var(--accent-on)",
        },
        muted: {
          DEFAULT: "var(--bg-2)",
          foreground: "var(--text-3)",
        },
        accent: {
          DEFAULT: "var(--bg-hover)",
          foreground: "var(--text-1)",
        },
        popover: {
          DEFAULT: "var(--bg-3)",
          foreground: "var(--text-1)",
        },
        card: {
          DEFAULT: "var(--bg-2)",
          foreground: "var(--text-1)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--accent-on)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--accent-on)",
        },
        ai: {
          DEFAULT: "var(--ai)",
          foreground: "var(--ai-on)",
        },
        // Design tokens (marque — pas le "accent" sémantique shadcn ci-dessus)
        "bg-0": "var(--bg-0)",
        "bg-1": "var(--bg-1)",
        "bg-2": "var(--bg-2)",
        "bg-3": "var(--bg-3)",
        "bg-4": "var(--bg-4)",
        brand: "var(--accent)",
        "brand-bright": "var(--accent-bright)",
        "brand-deep": "var(--accent-deep)",
        "accent-bright": "var(--accent-bright)",
        "accent-deep": "var(--accent-deep)",
        "ai-bright": "var(--ai-bright)",
        "ai-deep": "var(--ai-deep)",
        danger: "var(--danger)",
        info: "var(--info)",
        "status-draft": "var(--status-draft)",
        "status-sent": "var(--status-sent)",
        "status-late": "var(--status-late)",
        "status-paid": "var(--status-paid)",
        "text-1": "var(--text-1)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "border-accent": "var(--border-accent)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        r1: "var(--r-1)",
        r2: "var(--r-2)",
        r3: "var(--r-3)",
        r4: "var(--r-4)",
        r5: "var(--r-5)",
        pill: "var(--r-pill)",
      },
      fontFamily: {
        sans: ["Geist", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "1": "var(--shadow-1)",
        "2": "var(--shadow-2)",
        "3": "var(--shadow-3)",
        "accent": "var(--shadow-accent)",
        "accent-glow": "var(--accent-glow)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
