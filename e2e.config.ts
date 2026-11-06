import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";

export default {
  tests: "tests/**/*.e2e.ts",
  targets: [
    {
      name: "demo-chromium",
      engine: web({ locale: "en-US" }),
      app: {
        url: "http://127.0.0.1:4173",
        command: {
          executable: "pnpm",
          args: [
            "--dir",
            "web",
            "exec",
            "vite",
            "--host",
            "127.0.0.1",
            "--port",
            "4173",
            "--strictPort",
          ],
          env: { VITE_DEMO: "1" },
        },
      },
    },
  ],
  workers: 1,
  reporters: ["list", "junit"],
  video: "retain-on-failure",
} satisfies E2EConfig;
