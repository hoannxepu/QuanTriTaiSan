const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxW6C9L4sDhKMLO28_iaxLrUS834iKCoYkkQJbxGz_e2vpGPf3KVJxzr2tvoY5EIZ0tbw/exec';

function computeSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `w/"etag_${Math.abs(hash)}_${str.length}"`;
}

// Cloudflare Pages Function Proxy for Google Drive Sync
export async function onRequestGet(context: any) {
  try {
    const req = context.request;
    const ifNoneMatch = req?.headers?.get('if-none-match');

    const url = `${APPS_SCRIPT_URL}?t=${Date.now()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    const text = await response.text();
    const etag = computeSimpleHash(text);

    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(text, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: etag,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Expose-Headers': 'ETag, Cache-Control',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from Google Drive', details: err?.message }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function onRequestPost(context: any) {
  try {
    const req = context.request;
    const body = await req.text();

    // Verify valid JSON before saving
    if (!body || body.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Payload rỗng (0 bytes)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: 'Dữ liệu không phải JSON hợp lệ' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: body,
    });

    const newEtag = computeSimpleHash(body);

    return new Response(JSON.stringify({ success: true, etag: newEtag }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ETag: newEtag,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'ETag',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to save to Google Drive', details: err?.message }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
