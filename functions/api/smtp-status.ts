// Cloudflare Pages Function: /api/smtp-status
export async function onRequestGet(context: any): Promise<Response> {
  const env = context.env || {};
  const isConfigured = Boolean(env.SMTP_USER || env.GMAIL_USER);

  return new Response(
    JSON.stringify({
      configured: isConfigured,
      user: isConfigured ? (env.SMTP_USER || env.GMAIL_USER) : null,
      provider: 'Cloudflare Pages & Worker SMTP',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
