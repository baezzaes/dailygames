// 배치 랭킹 조회: 9개 게임을 D1 batch로 한 번에 조회 (9 Function 호출 → 1)
const GAMES = [
  { id: 'bacteria',   sort: 'desc' },
  { id: 'starblitz',  sort: 'desc' },
  { id: 'breakout',   sort: 'desc' },
  { id: 'reaction',   sort: 'asc'  },
  { id: 'memory',     sort: 'desc' },
  { id: 'stopbar',    sort: 'desc' },
  { id: 'snake',      sort: 'desc' },
  { id: 'fortress',   sort: 'desc' },
  { id: 'flappybird', sort: 'desc' },
];

const WEEK_KEY_RE  = /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/;
const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const KST_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toUtcStr(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function weekRange(periodKey) {
  const m = WEEK_KEY_RE.exec(periodKey);
  if (!m) return null;
  const year = +m[1], week = +m[2];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mon = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
  mon.setUTCDate(mon.getUTCDate() + (week - 1) * 7);
  const thu = new Date(mon); thu.setUTCDate(mon.getUTCDate() + 3);
  if (thu.getUTCFullYear() !== year) return null;
  const startMs = Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate()) - KST_MS;
  return { s: toUtcStr(startMs), e: toUtcStr(startMs + WEEK_MS) };
}

function monthRange(periodKey) {
  const m = MONTH_KEY_RE.exec(periodKey);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1;
  return { s: toUtcStr(Date.UTC(y, mo, 1) - KST_MS), e: toUtcStr(Date.UTC(y, mo + 1, 1) - KST_MS) };
}

function buildStmt(db, gameId, sort, mode, periodKey, limit) {
  const best  = sort === 'asc' ? 'MIN(score)' : 'MAX(score)';
  const order = sort === 'asc' ? 'ASC' : 'DESC';
  const cte   = `WITH f AS (SELECT name,score,created_at FROM scores WHERE game_id=?1 AND %%COND%%),
    b AS (SELECT name,${best} AS bs FROM f GROUP BY name),
    p AS (SELECT f.name,b.bs AS score,MIN(f.created_at) AS ca FROM f JOIN b ON b.name=f.name AND b.bs=f.score GROUP BY f.name,b.bs)
    SELECT name,score FROM p ORDER BY score ${order},ca ASC LIMIT `;

  if (mode === 'daily') {
    return db.prepare(
      cte.replace('%%COND%%', "mode='daily' AND period_key=?2") + '?3'
    ).bind(gameId, periodKey, limit);
  }
  if (mode === 'weekly') {
    const r = weekRange(periodKey);
    if (!r) return null;
    return db.prepare(
      cte.replace('%%COND%%', "mode='daily' AND created_at>=?2 AND created_at<?3") + '?4'
    ).bind(gameId, r.s, r.e, limit);
  }
  if (mode === 'monthly') {
    const r = monthRange(periodKey);
    if (!r) return null;
    return db.prepare(
      cte.replace('%%COND%%', "mode='daily' AND created_at>=?2 AND created_at<?3") + '?4'
    ).bind(gameId, r.s, r.e, limit);
  }
  if (mode === 'alltime') {
    return db.prepare(
      `WITH b AS (SELECT name,${best} AS bs FROM scores WHERE game_id=?1 AND mode='daily' GROUP BY name),
       p AS (SELECT s.name,b.bs AS score,MIN(s.created_at) AS ca FROM scores s JOIN b ON b.name=s.name AND b.bs=s.score WHERE s.game_id=?1 AND s.mode='daily' GROUP BY s.name,b.bs)
       SELECT name,score FROM p ORDER BY score ${order},ca ASC LIMIT ?2`
    ).bind(gameId, limit);
  }
  return null;
}

function validMode(m) {
  return m === 'daily' || m === 'weekly' || m === 'monthly' || m === 'alltime';
}

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return Response.json({ ok: false, error: 'db_binding_missing' }, { status: 500 });

    const url = new URL(context.request.url);
    const mode      = String(url.searchParams.get('mode') || '').trim();
    const periodKey = String(url.searchParams.get('periodKey') || '').trim();
    const limitNum  = Number(url.searchParams.get('limit') || 50);
    const limit     = Number.isFinite(limitNum) ? Math.min(Math.max(limitNum, 1), 50) : 50;
    const noCache   = url.searchParams.has('_nc');

    if (!validMode(mode) || !periodKey) {
      return Response.json({ ok: false, error: 'invalid_query' }, { status: 400 });
    }

    const db    = context.env.DB;
    const stmts = GAMES.map(g => buildStmt(db, g.id, g.sort, mode, periodKey, limit));
    if (stmts.some(s => !s)) return Response.json({ ok: false, error: 'invalid_query' }, { status: 400 });

    const batch  = await db.batch(stmts);
    const games  = {};
    GAMES.forEach((g, i) => { games[g.id] = batch[i].results || []; });

    const headers = { 'content-type': 'application/json; charset=utf-8' };
    if (!noCache) headers['Cache-Control'] = 'public, max-age=60';
    return new Response(JSON.stringify({ ok: true, games }), { headers });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', detail: e?.message || String(e) }, { status: 500 });
  }
}
