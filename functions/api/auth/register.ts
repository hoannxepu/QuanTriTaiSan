import { normalizeIdentifier, hashPassword, createSessionToken } from '../_auth';
import { INITIAL_DATABASE_STATE } from '../_defaults';

interface Env {
  DB: any;
  SESSION_SECRET?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { request, env } = context;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawIdentifier = (body as any).identifier;
    const password = (body as any).password;

    const norm = normalizeIdentifier(rawIdentifier);
    if (!norm) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tài khoản không hợp lệ. Vui lòng nhập Số điện thoại 10 số (bắt đầu bằng 0) hoặc Email hợp lệ.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const identifier = norm.value;
    const db = env.DB;

    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check existing
    const existing = await db.prepare('SELECT id FROM users WHERE identifier = ?').bind(identifier).first();
    if (existing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tài khoản này đã được đăng ký trên hệ thống' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { hash, salt } = await hashPassword(password);
    const id = globalThis.crypto.randomUUID();
    const userId = 'usr_' + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const now = Date.now();

    const initialDataStr = JSON.stringify(INITIAL_DATABASE_STATE);

    // Insert user & user_data
    await db.batch([
      db
        .prepare(
          'INSERT INTO users (id, identifier, pass_hash, pass_salt, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(id, identifier, hash, salt, userId, now),
      db
        .prepare('INSERT INTO user_data (user_id, version, updated_at, data) VALUES (?, 1, ?, ?)')
        .bind(userId, now, initialDataStr),
    ]);

    const token = await createSessionToken(userId, identifier, env.SESSION_SECRET);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user_id: userId,
        identifier,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi đăng ký tài khoản: ' + (err.message || 'Lỗi không xác định') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
