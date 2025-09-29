// src/lib/tele.ts
import crypto from "crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function signJoin(consultaId: number, ts: number, secret = process.env.TELE_JOIN_SECRET || "") {
  if (!secret) throw new Error("Defina TELE_JOIN_SECRET nas variáveis de ambiente.");
  const h = crypto.createHmac("sha256", secret);
  h.update(`${consultaId}.${ts}`);
  return b64url(h.digest());
}

export function verifyJoin(params: { consultaId: number; ts: number; sig: string; ttlMs?: number; secret?: string }) {
  const { consultaId, ts, sig, ttlMs = DEFAULT_TTL_MS, secret = process.env.TELE_JOIN_SECRET || "" } = params;
  if (!secret) return { ok: false, reason: "NO_SECRET" as const };
  if (!consultaId || !ts || !sig) return { ok: false, reason: "BAD_PARAMS" as const };

  const now = Date.now();
  if (ts > now + 5 * 60 * 1000) return { ok: false, reason: "FUTURE_TS" as const };
  if (now - ts > ttlMs) return { ok: false, reason: "EXPIRED" as const };

  const expected = signJoin(consultaId, ts, secret);
  if (expected !== sig) return { ok: false, reason: "BAD_SIG" as const };

  return { ok: true as const };
}
