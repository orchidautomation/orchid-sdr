import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./examples/reference-app/tests/setup.ts"],
  },
});
