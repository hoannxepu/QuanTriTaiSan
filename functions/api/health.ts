// Cloudflare Pages Function: /api/health
export async function onRequestGet(): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
