/**
 * Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`. The legacy
 * `x-cron-secret` header is still accepted for manual runs. Fails closed when
 * CRON_SECRET is not configured — previously an unset secret compared
 * `undefined !== undefined` and let any caller run the job.
 */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}` || req.headers.get("x-cron-secret") === secret;
}
