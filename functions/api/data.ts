import { verifySessionToken } from './_auth';

interface Env {
  DB: any;
  SESSION_SECRET?: string;
}

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB limit

function validateDatabaseState(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  // Mandatory core state arrays
  if (!Array.isArray(data.assets)) return false;
  if (!Array.isArray(data.debts)) return false;
  if (!Array.isArray(data.goals)) return false;
  return true;
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { request, env } = context;
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const session = await verifySessionToken(token, env.SESSION_SECRET);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cơ sở dữ liệu D1 chưa được cấu hình' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const row = (await db
      .prepare('SELECT version, updated_at, data FROM user_data WHERE user_id = ?')
      .bind(session.userId)
      .first()) as { version: number; updated_at: number; data: string } | null;

    if (!row) {
      return new Response(
        JSON.stringify({ success: false, error: 'Không tìm thấy dữ liệu tài khoản' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ETag / If-None-Match check (PWA bandwidth optimization)
    const ifNoneMatch = request.headers.get('If-None-Match');
    const versionEtag = `"${row.version}"`;

    if (ifNoneMatch && (ifNoneMatch === versionEtag || ifNoneMatch === String(row.version))) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: versionEtag,
          'Cache-Control': 'no-cache',
        },
      });
    }

    let parsedData = {};
    try {
      parsedData = JSON.parse(row.data);
    } catch (e) {
      parsedData = {};
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: row.version,
        updatedAt: row.updated_at,
        data: parsedData,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: versionEtag,
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi tải dữ liệu: ' + (err.message || 'Lỗi không xác định') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function onRequestPut(context: { request: Request; env: Env }): Promise<Response> {
  try {
    const { request, env } = context;
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    const session = await verifySessionToken(token, env.SESSION_SECRET);
    if (!session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check payload size
    const rawText = await request.text();
    if (rawText.length > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dung lượng dữ liệu vượt quá giới hạn 2MB' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Định dạng JSON không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { version, data } = body;
    if (typeof version !== 'number' || version < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Số phiên bản (version) không hợp lệ' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!validateDatabaseState(data)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dữ liệu không hợp lệ hoặc thiếu các trường bắt buộc (assets, debts, goals). Từ chối ghi đè.',
        }),
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

    const now = Date.now();
    const dataStr = JSON.stringify(data);

    // Optimistic concurrency control: UPDATE WHERE user_id = ? AND version = ?
    const updateResult = await db
      .prepare(
        'UPDATE user_data SET version = version + 1, updated_at = ?, data = ? WHERE user_id = ? AND version = ?'
      )
      .bind(now, dataStr, session.userId, version)
      .run();

    const changes = updateResult.meta?.changes ?? (updateResult as any).changes ?? 0;

    if (changes === 0) {
      // Conflict detected! Fetch current server state to assist client resolution
      const current = (await db
        .prepare('SELECT version, updated_at, data FROM user_data WHERE user_id = ?')
        .bind(session.userId)
        .first()) as { version: number; updated_at: number; data: string } | null;

      let currentData = null;
      if (current) {
        try {
          currentData = JSON.parse(current.data);
        } catch (e) {}
      }

      return new Response(
        JSON.stringify({
          success: false,
          conflict: true,
          error: 'Xung đột dữ liệu: phiên bản trên máy chủ đã thay đổi',
          currentVersion: current ? current.version : version + 1,
          currentData,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newVersion = version + 1;
    return new Response(
      JSON.stringify({
        success: true,
        newVersion,
        updatedAt: now,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: 'Lỗi lưu dữ liệu: ' + (err.message || 'Lỗi không xác định') }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
