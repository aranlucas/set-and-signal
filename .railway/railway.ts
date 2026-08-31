import {
  defineRailway,
  github,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

const publicDomain = "opengym2.up.railway.app";
const publicOrigin = `https://${publicDomain}`;

export default defineRailway(() => {
  // Keep the existing Railway address so adopting this file never replaces the
  // SQLite volume. The user-facing project and application identity is Set & Signal.
  const data = volume("opengym2-demo-volume", {
    region: "us-west2",
    sizeMB: 5_000,
    allowOnlineResize: true,
    alerts: {
      usage: {
        "80": {},
        "95": {},
        "100": {},
      },
    },
  });

  const app = service("opengym2-demo", {
    source: github("aranlucas/set-and-signal", { branch: "main" }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      buildEnvironment: "V3",
    },
    deploy: {
      runtime: "V2",
      healthcheckPath: "/api/health",
      healthcheckTimeout: 100,
      sleepApplication: true,
      restartPolicyMaxRetries: 3,
      multiRegionConfig: {
        "us-west2": { numReplicas: 1 },
      },
      limitOverride: {
        containers: {
          cpu: 0.5,
          memoryBytes: 500_000_000,
        },
      },
      ipv6EgressEnabled: false,
      useLegacyStacker: false,
    },
    env: {
      DATA_DIR: "/data",
      OPENROUTER_API_KEY: preserve(),
      ORIGIN: publicOrigin,
      PUBLIC_URL: publicOrigin,
      RP_ID: publicDomain,
      RP_NAME: "Set & Signal",
    },
    volumeMounts: {
      "/data": data,
    },
  });

  return project("Set & Signal", {
    resources: [app, data],
  });
});
