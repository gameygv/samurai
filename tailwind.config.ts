import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Profundidad Espresso
        slate: {
          50: '#FAF9F6',
          400: '#A38779',
          800: '#1F1714', // Bordes
          900: '#120D0B', // Tarjetas
          950: '#070504', // Fondo base
        },
        // Acento Samurai (Amber/Gold)
        indigo: {
          500: '#946f51', // Marca original
          600: '#7A5A41',
          shadow: 'rgba(148, 111, 81, 0.2)',
        },
        amber: {
          500: '#D4AF37', // Oro táctico para alertas e IA
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'tactical': '0 10px 30px -10px rgba(0,0,0,0.5)',
        'glow': '0 0 15px rgba(148, 111, 81, 0.15)',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;