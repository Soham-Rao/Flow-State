import type { Response } from "express";

export function setPrivateShortCache(res: Response, seconds: number, staleWhileRevalidateSeconds = seconds): void {
  const maxAge = Math.max(0, Math.floor(seconds));
  const staleWhileRevalidate = Math.max(0, Math.floor(staleWhileRevalidateSeconds));
  res.set("Cache-Control", `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  res.set("Vary", "Authorization");
}

export function setNoStore(res: Response): void {
  res.set("Cache-Control", "no-store");
}
