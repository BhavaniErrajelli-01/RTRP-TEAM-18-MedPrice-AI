/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    500: '#14b8a6', // Teal 500 for medical/trust vibe
                    600: '#0d9488',
                    900: '#134e4a',
                }
            }
        },
    },
    plugins: [],
}
