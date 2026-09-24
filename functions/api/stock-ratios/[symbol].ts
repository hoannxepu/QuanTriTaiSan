// Cloudflare Pages Function: /api/stock-ratios/:symbol
import { fetchRatiosForSymbol } from './index';

export async function onRequestGet(context: any): Promise<Response> {
  const { params } = context;
  const rawSym = (params.symbol || '').trim().toUpperCase();

  if (!rawSym || !/^[A-Z0-9]{3,4}$/.test(rawSym)) {
    return new Response(JSON.stringify({ error: 'Mã cổ phiếu không hợp lệ' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = await fetchRatiosForSymbol(rawSym);

  return new Response(JSON.stringify({ success: true, data }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=600',
    },
  });
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
