import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Use jsdom for hook tests
    environmentMatchGlobs: [
      ["tests/hooks/**", "jsdom"],
      ["tests/components/**", "jsdom"],
    ],
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "hooks/**/*.ts"],
      exclude: ["lib/supabase/**", "**/*.d.ts", "**/*.test.ts", "**/*.spec.ts"],
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
