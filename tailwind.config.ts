import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        spotify: {
          dark: "#121212",
          charchoal: "#181818",
          neonGreen: "#1db954",
          crimson: "#ff4d4f",
          electricBlue: "#1890ff"
        }
      },
    },
  },
  plugins: [],
};
export default config;
