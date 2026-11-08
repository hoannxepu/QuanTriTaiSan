import {
  normalizeIdentifier,
  verifyPassword,
  createSessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  getSessionSecret,
} from '../_auth';

interface Env {
  DB: any;
  SESSION_SECRET?: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { request, env } = context;
    const secret = getSessionSecret(env);
    const db = env.DB;

    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ success: false, error: 'Dữ liệu không hợp lệ' }), {
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
          error: 'Tài khoản không hợp lệ. Vui lòng nhập Số điện thoại 10 số hoặc Email.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Vui lòng nhập mật khẩu' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const identifier = norm.value;

    // Persistent D1 Rate-limiting check
    const isAllowed = await checkRateLimit(db, identifier);
    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '900',
          },
        }
      );
    }

    const user = (await db
      .prepare('SELECT user_id, pass_hash, pass_salt FROM users WHERE identifier = ?')
      .bind(identifier)
      .first()) as { user_id: string; pass_hash: string; pass_salt: string } | null;

    if (!user) {
      await recordFailedAttempt(db, identifier);
      return new Response(
        JSON.stringify({ success: false, error: 'Thông tin tài khoản hoặc mật khẩu không chính xác' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isMatch = await verifyPassword(password, user.pass_hash, user.pass_salt);
    if (!isMatch) {
      await recordFailedAttempt(db, identifier);
      return new Response(
        JSON.stringify({ success: false, error: 'Thông tin tài khoản hoặc mật khẩu không chính xác' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Success: reset rate limit in D1
    await resetRateLimit(db, identifier);

    // Fetch latest version
    const userData = (await db
      .prepare('SELECT version FROM user_data WHERE user_id = ?')
      .bind(user.user_id)
      .first()) as { version: number } | null;

    const version = userData ? userData.version : 1;
    const token = await createSessionToken(user.user_id, identifier, secret);

    return new Response(
      JSON.stringify({
        success: true,
        token,
        user_id: user.user_id,
        identifier,
        version,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi đăng nhập: ' + (err.message || 'Lỗi không xác định') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
