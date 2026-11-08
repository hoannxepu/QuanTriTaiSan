import {
  verifySessionToken,
  verifyPassword,
  hashPassword,
  createSessionToken,
} from '../_auth';

interface Env {
  DB: any;
  SESSION_SECRET?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { request, env } = context;
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const session = await verifySessionToken(token, env.SESSION_SECRET);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Dữ liệu không hợp lệ' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { oldPassword, newPassword } = body as any;
    if (!oldPassword || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = (await db
      .prepare('SELECT pass_hash, pass_salt FROM users WHERE user_id = ?')
      .bind(session.userId)
      .first()) as { pass_hash: string; pass_salt: string } | null;

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy thông tin tài khoản' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isMatch = await verifyPassword(oldPassword, user.pass_hash, user.pass_salt);
    if (!isMatch) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu hiện tại không đúng' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);

    await db
      .prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE user_id = ?')
      .bind(newHash, newSalt, session.userId)
      .run();

    const newToken = await createSessionToken(session.userId, session.identifier, env.SESSION_SECRET);

    return new Response(
      JSON.stringify({
        success: true,
        token: newToken,
        message: 'Đổi mật khẩu thành công',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi đổi mật khẩu: ' + (err.message || 'Lỗi không xác định') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
