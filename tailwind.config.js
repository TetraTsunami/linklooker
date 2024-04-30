/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./**/*.tsx"],
  plugins: [],
  theme: {
    extend: {
      boxShadow: {
        "i-lg": "#000b 0px 10px 40px, #fff5 0px 0px 20px inset",
      }
    }
  }
}