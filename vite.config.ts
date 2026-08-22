import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

/**
 * Vercel-only production target: vinext + Nitro.
 * Cloudflare Workers / wrangler are intentionally not wired here.
 */
export default defineConfig({
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [vinext(), nitro()],
});
