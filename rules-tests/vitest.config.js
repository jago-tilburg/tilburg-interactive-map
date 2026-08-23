const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.js"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Rules tests share one emulator connection per suite via a module-level
    // testEnv — running files in parallel workers would each try to spin up
    // their own connection races against the same emulator ports.
    fileParallelism: false,
  },
});
