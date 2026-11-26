import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** The short commit this build was made from, so a phone can say exactly which version it is running. */
function build(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

// Relative base, so the build works from any folder or sub-path on a static host.
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(build()) } });
