// 관리자 API
// - stats/list/trend/dates 조회
// - delete/bulk-delete 등 관리성 삭제 작업
const VALID_GAME_IDS = new Set([
  "click10","reaction","dodger","memory","runner","stopbar","numbertap","lanetap","shadow","balance"
]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    ...init,
  });
}

function auth(context) {
  // x-admin-secret 헤더로 관리자 요청을 인증합니다.
  const provided = context.request.headers.get("x-admin-secret") || "";
  const expected = (context.env && context.env.ADMIN_SECRET) || "";
  if (!expected) return json({ ok: false, error: "admin_not_configured" }, { status: 503 });
  if (provided !== expected) return json({ ok: false, error: "unauthorized" }, { status: 401 });
  return null;
}

export async function onRequest(context) {
  const deny = auth(context);
  if (deny) return deny;

  if (!context.env || !context.env.DB) {
    return json({ ok: false, error: "db_binding_missing" }, { status: 500 });
  }

  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";

  try {
    /* ── GET ──────────────────────────────────────────────── */
    if (request.method === "GET") {

      // 특정 날짜 요약(게임별 플레이 수/유저 수/점수 통계)
      if (action === "stats") {
        const date = (url.searchParams.get("date") || "").trim();
        if (!date) return json({ ok: false, error: "missing_date" }, { status: 400 });

        const [{ results }, { results: totals }] = await Promise.all([
          env.DB.prepare(`
            SELECT
              game_id,
              COUNT(*)             AS play_count,
              COUNT(DISTINCT name) AS player_count,
              MIN(score)           AS min_score,
              MAX(score)           AS max_score,
              AVG(score)           AS avg_score
            FROM scores
            WHERE mode = 'daily' AND period_key = ?1
            GROUP BY game_id
            ORDER BY play_count DESC
          `).bind(date).all(),
          env.DB.prepare(`
            SELECT COUNT(DISTINCT name) AS total_players
            FROM scores
            WHERE mode = 'daily' AND period_key = ?1
          `).bind(date).all(),
        ]);

        const total_players = totals?.[0]?.total_players ?? 0;
        return json({ ok: true, date, rows: results || [], total_players });
      }

      // 특정 게임+날짜의 전체 점수 목록
      if (action === "list") {
        const gameId = (url.searchParams.get("gameId") || "").trim();
        const date   = (url.searchParams.get("date")   || "").trim();
        const rawSort = (url.searchParams.get("sort") || "desc").toLowerCase();
        const order  = rawSort === "asc" ? "ASC" : "DESC";

        if (!gameId || !date) return json({ ok: false, error: "missing_params" }, { status: 400 });
        if (!VALID_GAME_IDS.has(gameId)) return json({ ok: false, error: "invalid_game_id" }, { status: 400 });

        const { results } = await env.DB.prepare(`
          SELECT name, score, created_at
          FROM scores
          WHERE game_id = ?1 AND mode = 'daily' AND period_key = ?2
          ORDER BY score ${order}, created_at ASC
        `).bind(gameId, date).all();

        return json({ ok: true, gameId, date, rows: results || [] });
      }

      // 최근 N일 추이(일자/게임별 플레이 수, 유저 수)
      if (action === "trend") {
        const rawDays = parseInt(url.searchParams.get("days") || "7", 10);
        const days = Math.min(Math.max(rawDays, 1), 30);

        const { results } = await env.DB.prepare(`
          SELECT
            period_key,
            game_id,
            COUNT(*)            AS play_count,
            COUNT(DISTINCT name) AS player_count
          FROM scores
          WHERE mode = 'daily'
            AND period_key >= date('now', ?1)
          GROUP BY period_key, game_id
          ORDER BY period_key DESC, play_count DESC
        `).bind(`-${days} days`).all();

        return json({ ok: true, days, rows: results || [] });
      }

      // 점수가 존재하는 날짜 목록(관리자 날짜 선택용)
      if (action === "dates") {
        const rawLimit = parseInt(url.searchParams.get("limit") || "30", 10);
        const limit = Math.min(Math.max(rawLimit, 1), 90);

        const { results } = await env.DB.prepare(`
          SELECT DISTINCT period_key
          FROM scores
          WHERE mode = 'daily'
          ORDER BY period_key DESC
          LIMIT ?1
        `).bind(limit).all();

        return json({ ok: true, rows: results || [] });
      }

      return json({ ok: false, error: "unknown_action" }, { status: 400 });
    }

    /* ── DELETE ───────────────────────────────────────────── */
    if (request.method === "DELETE") {
      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "invalid_payload" }, { status: 400 }); }

      const gameId = String(body.gameId || "").trim();
      const date   = String(body.date   || "").trim();

      if (!gameId || !date) return json({ ok: false, error: "missing_params" }, { status: 400 });
      if (!VALID_GAME_IDS.has(gameId)) return json({ ok: false, error: "invalid_game_id" }, { status: 400 });

      const r = await env.DB.prepare(
        "DELETE FROM scores WHERE game_id = ?1 AND mode = 'daily' AND period_key = ?2"
      ).bind(gameId, date).run();

      return json({ ok: true, deleted: r.meta?.changes ?? 0 });
    }

    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  } catch (e) {
    return json(
      { ok: false, error: "server_error", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
