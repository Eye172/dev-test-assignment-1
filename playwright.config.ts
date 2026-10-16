import { defineConfig, devices } from "@playwright/test";
const remoteBaseURL = process.env.E2E_BASE_URL;
// The isolated local/CI server models three clients behind a trusted proxy. Each keeps the real 60/hour
// creation limit; a growing suite must not consume one shared client's quota.
const isolateClients = !remoteBaseURL && process.env.E2E_ISOLATE_CLIENTS !== "false";
const clientHeaders = (client: number) => isolateClients
  ? { "x-forwarded-for": `198.18.0.${client}` } : undefined;
export default defineConfig({
  testDir: "./e2e",fullyParallel: false,workers: 1,timeout: 60000,
  expect: { timeout: 10000 },retries: process.env.CI ? 1 : 0,
  reporter: [["list"],["html",{ open: "never" }]],
  use: { baseURL: remoteBaseURL || "http://127.0.0.1:3000",trace: "retain-on-failure",screenshot: "only-on-failure",video: "retain-on-failure" },
  projects: [
    { name: "api",testMatch: "api.spec.ts",use: { extraHTTPHeaders: clientHeaders(1) } },
    { name: "desktop",testIgnore: "api.spec.ts",use: { ...devices["Desktop Chrome"],viewport: { width: 1440,height: 1000 },extraHTTPHeaders: clientHeaders(2) } },
    { name: "mobile",testIgnore: "api.spec.ts",use: { ...devices["iPhone 13"],defaultBrowserType: "chromium",extraHTTPHeaders: clientHeaders(3) } },
  ],
  webServer: remoteBaseURL ? undefined : {
    command: "npm run start",url: "http://127.0.0.1:3000/api/health",reuseExistingServer: false,timeout: 120000,
    env: { ALLOW_LOCAL_DATABASE: "true",DEMO_MODE: "true",PGLITE_DATA_DIR: ".data/e2e",NEXT_TELEMETRY_DISABLED: "1",HOSTNAME: "127.0.0.1",TRUST_PROXY: isolateClients ? "true" : "false" },
  },
});
