import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Escala Base (Espresso/Mocha) para fondos y textos legibles
        slate: {
          50: '#fcfafa',  // Crema brillante para textos principales
          100: '#f2ebe8',
          200: '#dfd0c9',
          300: '#c7b1a5',
          400: '#a38779',  // Textos secundarios
          500: '#8c7061',  // Textos muteados
          600: '#6b5347',
          700: '#4a3830',
          800: '#2e221d',  // Bordes y separadores
          900: '#1a1310',  // Fondo de Tarjetas (Dark Espresso)
          950: '#0d0a08',  // Fondo Base de la App (Ultra Dark)
        },
        // Escala Primaria (Basada en el #946f51 de The Elephant Bowl)
        // Mapeamos 'indigo' a tu color de marca para no tener que cambiar las clases de los componentes
        indigo: {
          50: '#f6f3f0',
          100: '#e8ded7',
          200: '#d5c0b1',
          300: '#be9e87',
          400: '#a88162',  // Acentos claros
          500: '#946f51',  // <--- Color exacto del Logo (Botones base)
          600: '#7a5a41',  // Hover de botones
          700: '#614634',
          800: '#4a3629',
          900: '#3d2d23',  // Fondos tenues de acento
          950: '#211812',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;