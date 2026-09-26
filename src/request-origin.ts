// Use trusted server configuration behind a proxy, never client-supplied Host headers.
export function expectedOrigin(request: Request): string {
  const configured = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  return new URL(configured || request.url).origin;
}
