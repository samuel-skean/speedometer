/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    globals: true, // optional: allows using describe, it, expect without import
    setupFiles: [], // Add setup file if needed later
  },
});
