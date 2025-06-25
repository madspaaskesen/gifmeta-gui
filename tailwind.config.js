// tailwind.config.js
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          ...require("daisyui/src/colors/themes")["[data-theme=light]"],
        },
        dark: {
          ...require("daisyui/src/colors/themes")["[data-theme=dark]"],
        },
        cupcake: {
          ...require("daisyui/src/colors/themes")["[data-theme=cupcake]"],
        },
      },
    ],
    darkTheme: "dark", // optional: sets default dark theme when OS is dark
  },
}
