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
        ink: "#171412",
        moss: "#4e4942",
        jade: "#0f5f52",
        mist: "#e7f1ed",
        pearl: "#f7f4ee",
        clay: "#a8742a",
        gold: "#c39a5f",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 20, 18, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
