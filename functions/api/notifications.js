// 도발 알림 API
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// GET /api/notifications?name=xxx — 미확인 알림 조회
export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return json({ ok: false, error: 'db_binding_missing' }, 500);
    const name = String(new URL(context.request.url).searchParams.get('name') || '').trim();
    if (!name) return json({ ok: false, error: 'missing_name' }, 400);

    const { results } = await context.env.DB.prepare(
      'SELECT id, from_name, game_title FROM notifications WHERE to_name=?1 AND seen=0 ORDER BY created_at DESC LIMIT 10'
    ).bind(name).all();

    return json({ ok: true, notifications: results || [] });
  } catch (e) {
    return json({ ok: false, error: 'server_error', detail: e?.message }, 500);
  }
}

// POST /api/notifications — 도발 알림 생성
export async function onRequestPost(context) {
  try {
    if (!context.env?.DB) return json({ ok: false, error: 'db_binding_missing' }, 500);
    const body = await context.request.json();
    const toName    = String(body.toName    || '').trim().slice(0, 25);
    const fromName  = String(body.fromName  || '').trim().slice(0, 25);
    const gameId    = String(body.gameId    || '').trim().slice(0, 30);
    const gameTitle = String(body.gameTitle || '').trim().slice(0, 30);

    if (!toName || !fromName || !gameId || toName === fromName) {
      return json({ ok: false, error: 'invalid_payload' }, 400);
    }

    await context.env.DB.prepare(
      'INSERT INTO notifications (to_name, from_name, game_id, game_title) VALUES (?1, ?2, ?3, ?4)'
    ).bind(toName, fromName, gameId, gameTitle).run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', detail: e?.message }, 500);
  }
}

// PATCH /api/notifications — 알림 읽음 처리
export async function onRequestPatch(context) {
  try {
    if (!context.env?.DB) return json({ ok: false, error: 'db_binding_missing' }, 500);
    const { name } = await context.request.json();
    const n = String(name || '').trim();
    if (!n) return json({ ok: false, error: 'missing_name' }, 400);

    await context.env.DB.prepare(
      'UPDATE notifications SET seen=1 WHERE to_name=?1 AND seen=0'
    ).bind(n).run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'server_error', detail: e?.message }, 500);
  }
}
