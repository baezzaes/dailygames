// 랭킹 조회/삭제 API
// - daily: period_key 기준 단일 기간 조회
// - weekly: created_at(KST 주간 범위) 기준 집계 조회
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function validMode(mode) {
  return mode === "daily" || mode === "weekly";
}

function validSort(sort) {
  return sort === "asc" || sort === "desc";
}

const WEEK_KEY_RE = /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseWeekKey(periodKey) {
  // 입력 형식: YYYY-Www (예: 2026-W14)
  const m = WEEK_KEY_RE.exec(periodKey);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week)) return null;
  return { year, week };
}

function getWeekStartDateFromIsoWeek(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // 1(Mon) ... 7(Sun)
  const week1Monday = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  // Validate the requested ISO week exists in this year.
  const thursday = new Date(start);
  thursday.setUTCDate(start.getUTCDate() + 3);
  if (thursday.getUTCFullYear() !== year) return null;

  return start;
}

function toSqliteUtc(tsMs) {
  const d = new Date(tsMs);
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

function getWeeklyRangeByPeriodKey(periodKey) {
  // 주간 키를 KST 주간 범위(월 00:00 ~ 다음 월 00:00) UTC 시각으로 변환
  const parsed = parseWeekKey(periodKey);
  if (!parsed) return null;
  const startDate = getWeekStartDateFromIsoWeek(parsed.year, parsed.week);
  if (!startDate) return null;

  // ISO week key is interpreted as KST week (Mon 00:00 KST ~ next Mon 00:00 KST).
  const startUtcMs = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
    0, 0, 0, 0
  ) - KST_OFFSET_MS;
  const endUtcMs = startUtcMs + WEEK_MS;

  return {
    startUtc: toSqliteUtc(startUtcMs),
    endUtc: toSqliteUtc(endUtcMs),
  };
}

async function getDailyRows(db, gameId, mode, periodKey, sort, limit) {
  // 일간 모드도 닉네임별 최고 기록 1개만 노출합니다.
  const bestScoreExpr = sort === "asc" ? "MIN(score)" : "MAX(score)";
  const order = sort === "asc" ? "ASC" : "DESC";
  const { results } = await db.prepare(
    `WITH filtered AS (
       SELECT name, score, created_at
       FROM scores
       WHERE game_id = ?1 AND mode = ?2 AND period_key = ?3
     ),
     best AS (
       SELECT name, ${bestScoreExpr} AS best_score
       FROM filtered
       GROUP BY name
     ),
     picked AS (
       SELECT f.name AS name, b.best_score AS score, MIN(f.created_at) AS created_at
       FROM filtered f
       JOIN best b
         ON b.name = f.name
        AND b.best_score = f.score
       GROUP BY f.name, b.best_score
     )
     SELECT name, score, created_at
     FROM picked
     ORDER BY score ${order}, created_at ASC
     LIMIT ?4`
  )
    .bind(gameId, mode, periodKey, limit)
    .all();
  return results || [];
}

async function getWeeklyRows(db, gameId, periodKey, sort, limit) {
  // 주간 모드에서는 daily 원본을 기간 필터링 후, 닉네임별 최고 기록만 남깁니다.
  const range = getWeeklyRangeByPeriodKey(periodKey);
  if (!range) return null;

  const bestScoreExpr = sort === "asc" ? "MIN(score)" : "MAX(score)";
  const orderExpr = sort === "asc" ? "score ASC, created_at ASC" : "score DESC, created_at ASC";
  const { results } = await db.prepare(
    `WITH filtered AS (
       SELECT name, score, created_at
       FROM scores
       WHERE game_id = ?1
         AND mode = 'daily'
         AND created_at >= ?2
         AND created_at <  ?3
     ),
     best AS (
       SELECT name, ${bestScoreExpr} AS best_score
       FROM filtered
       GROUP BY name
     ),
     picked AS (
       SELECT f.name AS name, b.best_score AS score, MIN(f.created_at) AS created_at
       FROM filtered f
       JOIN best b
         ON b.name = f.name
        AND b.best_score = f.score
       GROUP BY f.name, b.best_score
     )
     SELECT name, score, created_at
     FROM picked
     ORDER BY ${orderExpr}
     LIMIT ?4`
  )
    .bind(gameId, range.startUtc, range.endUtc, limit)
    .all();

  return results || [];
}

export async function onRequestGet(context) {
  try {
    if (!context.env || !context.env.DB) {
      return json({ ok: false, error: "db_binding_missing" }, { status: 500 });
    }

    const url = new URL(context.request.url);
    const gameId = String(url.searchParams.get("gameId") || "").trim();
    const mode = String(url.searchParams.get("mode") || "").trim();
    const periodKey = String(url.searchParams.get("periodKey") || "").trim();
    const sort = String(url.searchParams.get("sort") || "desc").trim().toLowerCase();
    const limitNum = Number(url.searchParams.get("limit") || 10);
    const limit = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 50) : 10;

    if (!gameId || !validMode(mode) || !periodKey || !validSort(sort)) {
      return json({ ok: false, error: "invalid_query" }, { status: 400 });
    }

    let rows;
    if (mode === "weekly") {
      // weekly는 periodKey 검증 실패 시 400 invalid_query 반환
      rows = await getWeeklyRows(context.env.DB, gameId, periodKey, sort, limit);
      if (rows === null) {
        return json({ ok: false, error: "invalid_query" }, { status: 400 });
      }
    } else {
      rows = await getDailyRows(context.env.DB, gameId, mode, periodKey, sort, limit);
    }

    return json({ ok: true, rows }, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=60" } });
  } catch (e) {
    return json(
      {
        ok: false,
        error: "server_error",
        detail: e && e.message ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

export async function onRequestDelete(context) {
  try {
    if (!context.env || !context.env.DB) {
      return json({ ok: false, error: "db_binding_missing" }, { status: 500 });
    }

    const body = await context.request.json();
    const gameId = String(body.gameId || "").trim();
    const mode = String(body.mode || "").trim();
    const periodKey = String(body.periodKey || "").trim();

    if (!gameId || !validMode(mode) || !periodKey) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await context.env.DB.prepare(
      "DELETE FROM scores WHERE game_id = ?1 AND mode = ?2 AND period_key = ?3"
    )
      .bind(gameId, mode, periodKey)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json(
      {
        ok: false,
        error: "server_error",
        detail: e && e.message ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
