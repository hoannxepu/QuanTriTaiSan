// Cloudflare Pages Function: /api/send-email-report
export async function onRequestPost(context: any): Promise<Response> {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Gửi email tự động yêu cầu cấu hình SMTP Service. Vui lòng sử dụng tính năng xuất file Excel hoặc chạy trên máy chủ Node.js đầy đủ.',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
