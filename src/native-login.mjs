import { spawn } from "node:child_process";

/**
 * Google SSO refuses sign-in inside a CDP/Playwright-controlled Chrome ("browser or app may not be
 * secure"). The proven workaround (used by deepseek-web-bridge) is to log in with a *normal* Chrome
 * instance on the same dedicated profile, close it, and only then let Playwright reuse the profile.
 */
export function launchNativeChrome({ chromePath, profileDir, url }) {
  return new Promise((resolve, reject) => {
    const child = spawn(chromePath, [
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ], { stdio: "ignore", windowsHide: false });
    child.on("error", reject);
    child.on("exit", code => resolve(code ?? 0));
  });
}
