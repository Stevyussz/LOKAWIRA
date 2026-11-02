import type { Config } from "tailwindcss";

function withOpacity(variableName: string): any {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${variableName}) calc(100% * ${opacityValue}), transparent)`;
    }
    return `var(${variableName})`;
  };
}

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-display)", "Georgia", "serif"],
        num: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      colors: {
        obsidian: withOpacity("--bg-obsidian-ash"),
        andesite: withOpacity("--bg-andesite-base"),
        basalt: withOpacity("--bg-basalt-card"),
        slateElev: withOpacity("--bg-slate-elevated"),
        pumice: withOpacity("--bg-pumice-hover"),
        stoneSubtle: withOpacity("--border-stone-subtle"),
        stoneStrong: withOpacity("--border-stone-strong"),
        alabaster: withOpacity("--text-alabaster"),
        pebble: withOpacity("--text-pebble"),
        ashMuted: withOpacity("--text-ash-muted"),
        vibePrimary: withOpacity("--vibe-primary"),
        vibeSecondary: withOpacity("--vibe-secondary"),
        quotaSafe: withOpacity("--quota-safe"),
        quotaWarning: withOpacity("--quota-warning"),
        quotaFull: withOpacity("--quota-full"),
      },
    },
  },
  plugins: [],
};

export default config;
