/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // the desktop profile layout: any window at least 560x300 (windows shorter than 560 are drawn at
        // the desktop minimum size and scaled down, see AboutScreen's `fit`)
        // landscape phones and other short windows
        short: { raw: '(max-height: 520px)' },
        tall: { raw: '(min-width: 560px) and (min-height: 300px)' },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        trainer: ['"Pixelify Sans"', 'monospace'],
      },
    },
  },
  plugins: [],
}
