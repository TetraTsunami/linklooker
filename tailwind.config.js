/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: ["./**/*.tsx"],
  plugins: [],
  theme: {
    extend: {
      boxShadow: {
        "i-lg": "0px 0px 30px 0px #00000007, 0px 30px 60px 0px #00000027, inset 0px 0px 5px 0px hsla(0,0%,100%,.25)",
      }
    }
  }
}