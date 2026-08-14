// Loaded via NODE_OPTIONS="--require ./scripts/als-polyfill.cjs" so that every
// process (including Next dev render workers) sees AsyncLocalStorage on
// globalThis. Works around Next 15.5 custom-server dev-mode crash
// "Invariant: AsyncLocalStorage accessed in runtime where it is not available".
const als = require("node:async_hooks").AsyncLocalStorage;
if (!globalThis.AsyncLocalStorage) globalThis.AsyncLocalStorage = als;
