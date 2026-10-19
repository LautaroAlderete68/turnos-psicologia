import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: "#f4f7f5",
          100: "#e5ece7",
          200: "#cbdad0",
          300: "#a6c1b0",
          400: "#7fa38c",
          500: "#588269",
          600: "#456954",
          700: "#385444",
          800: "#2f4437",
          900: "#27392f",
          950: "#141f19",
        },
        warm: {
          50: "#fafaf7",
          100: "#f4f3ec",
          200: "#e9e7db",
          300: "#dad6c3",
          400: "#c4bea5",
          500: "#aba387",
          600: "#8e866e",
          700: "#706956",
          800: "#5a5446",
          900: "#4a453b",
          950: "#27241e",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
