import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        graphite: "var(--graphite)",
        paper: "var(--paper)",
        bone: "var(--bone)",
        muted: "var(--muted)",
        line: "var(--line)",
        brass: "var(--brass)",
        sage: "var(--sage)",
        mist: "var(--mist)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
