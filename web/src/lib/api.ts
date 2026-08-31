// Backend + WebAuthn helpers.
//
// The backend speaks the WebAuthn JSON format. SimpleWebAuthn owns the
// browser-specific base64url/buffer conversion and credential serialization so
// this boundary stays small and follows the maintained library contract.
import {
  authResponse,
  configResponse,
  loginOptionsResponse,
  parsePayload,
  payloadMessage,
  pushKeyResponse,
  registrationOptionsResponse,
  sessionResponse,
} from "./schemas.js";
import type { PayloadSchema } from "./schemas.js";
import type { User } from "./types.js";

export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/u.test(navigator.userAgent);
export const IS_ANDROID = /Android/u.test(navigator.userAgent);
export const BIO = IS_APPLE
  ? "Face ID / Touch ID"
  : IS_ANDROID
    ? "fingerprint or face unlock"
    : "your fingerprint, face or PIN";
export const webauthnOK = () =>
  globalThis.PublicKeyCredential !== undefined &&
  typeof globalThis.PublicKeyCredential === "function";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api(path: string, opts?: RequestInit): Promise<unknown> {
  const response = await fetch(
    path,
    Object.assign({ headers: { "Content-Type": "application/json" } }, opts),
  );
  if (!response.ok) {
    const errorPayload: unknown = await response.json().catch(() => ({}));
    const message = payloadMessage(errorPayload) ?? `HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return response.json().catch(() => ({}));
}

export async function apiParsed<T>(
  path: string,
  schema: PayloadSchema<T>,
  opts?: RequestInit,
): Promise<T> {
  return parsePayload(schema, await api(path, opts));
}

export async function passkeyRegister(name: string, code: string): Promise<User> {
  const { cid, options } = await apiParsed("/api/register/options", registrationOptionsResponse, {
    method: "POST",
    body: JSON.stringify({ name, code: code || "" }),
  });
  const { startRegistration } = await import("@simplewebauthn/browser");
  const credential = await startRegistration({
    optionsJSON: options.publicKey,
  });
  const res = await apiParsed("/api/register/verify", authResponse, {
    method: "POST",
    body: JSON.stringify({ cid, credential }),
  });
  return res.user;
}

export async function passkeyLogin(): Promise<User> {
  const { cid, options } = await apiParsed("/api/login/options", loginOptionsResponse, {
    method: "POST",
    body: "{}",
  });
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const credential = await startAuthentication({
    optionsJSON: options.publicKey,
  });
  const res = await apiParsed("/api/login/verify", authResponse, {
    method: "POST",
    body: JSON.stringify({ cid, credential }),
  });
  return res.user;
}

export const getConfig = () => apiParsed("/api/config", configResponse);
export const getSession = () => apiParsed("/api/me", sessionResponse);
export const getPushKey = () => apiParsed("/api/push/public-key", pushKeyResponse);
