export async function onRequestPost(): Promise<Response> {
  return new Response(JSON.stringify({ success: true, message: 'Đã đăng xuất thành công' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
