import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30000,
    // forks pool with --expose-gc so globalThis.gc exists in every test; the heap checks in tests 9.3 and 9.5 fail, not skip, without it
    pool: "forks",
    poolOptions: {
      forks: {
        execArgv: ["--expose-gc"],
      },
    },
  },
});
