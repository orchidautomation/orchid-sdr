import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./examples/ai-sdr/tests/setup.ts"],
  },
});
