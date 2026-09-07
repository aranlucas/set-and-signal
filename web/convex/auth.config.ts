import type { AuthConfig } from "convex/server";
export default {
  providers: [
    {
      type: "customJwt",
      issuer: process.env.AUTH_ISSUER!,
      applicationID: "set-and-signal",
      algorithm: "RS256",
      jwks: process.env.AUTH_JWKS!,
    },
  ],
} satisfies AuthConfig;
