// Adapters take `fetch` as a dependency. A test that forgets to inject one fails
// here instead of quietly calling a real API.
globalThis.fetch = () => {
  throw new Error("network access in tests");
};
