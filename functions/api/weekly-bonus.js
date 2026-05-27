// 주간 보너스 계산: 7일×9게임을 D1 batch로 한 번에 조회 (63 Function 호출 → 1)
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

const DAILY_RANK_POINTS     = [20, 16, 13, 11, 9, 8, 7, 6, 5, 4];
const DAILY_MAX_RANK        = 10;
const DAILY_BONUS_PER_DAY_CAP = 20;
const DAILY_BONUS_WEEK_CAP  = 100;
const WEEK_KEY_RE = /^(\d{4})-W(0[1-9]|[1-4][0-9]|5[0-3])$/;

function getWeekDateKeys(weekKey) {
  const m = WEEK_KEY_RE.exec(weekKey);
  if (!m) return [];
  const year = +m[1], week = +m[2];
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mon = new Date(Date.UTC(year, 0, 4 - (jan4Day - 1)));
  mon.setUTCDate(mon.getUTCDate() + (week - 1) * 7);
  const thu = new Date(mon); thu.setUTCDate(mon.getUTCDate() + 3);
  if (thu.getUTCFullYear() !== year) return [];

  const KST_MS = 9 * 60 * 60 * 1000;
  const baseUtc = Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseUtc + i * 86400000 + KST_MS);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  });
}

function todayKst() {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) return Response.json({ ok: false, error: 'db_binding_missing' }, { status: 500 });

    const url     = new URL(context.request.url);
    const weekKey = String(url.searchParams.get('weekKey') || '').trim();
    if (!WEEK_KEY_RE.test(weekKey)) return Response.json({ ok: false, error: 'invalid_query' }, { status: 400 });

    const today    = todayKst();
    const weekDays = getWeekDateKeys(weekKey).filter(d => d <= today);
    const empty    = new Response(JSON.stringify({ ok: true, bonus: {} }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
    if (!weekDays.length) return empty;

    const db    = context.env.DB;
    const stmts = [];
    const meta  = [];

    for (const dayKey of weekDays) {
      for (const g of GAMES) {
        const best  = g.sort === 'asc' ? 'MIN(score)' : 'MAX(score)';
        const order = g.sort === 'asc' ? 'ASC' : 'DESC';
        stmts.push(db.prepare(
          `WITH f AS (SELECT name,score,created_at FROM scores WHERE game_id=?1 AND mode='daily' AND period_key=?2),
           b AS (SELECT name,${best} AS bs FROM f GROUP BY name),
           p AS (SELECT f.name,b.bs AS score,MIN(f.created_at) AS ca FROM f JOIN b ON b.name=f.name AND b.bs=f.score GROUP BY f.name,b.bs)
           SELECT name FROM p ORDER BY score ${order},ca ASC LIMIT ?3`
        ).bind(g.id, dayKey, DAILY_MAX_RANK));
        meta.push(dayKey);
      }
    }

    const batch = await db.batch(stmts);

    const playerDayPoints = new Map();
    batch.forEach((result, i) => {
      const dayKey = meta[i];
      (result.results || []).forEach((row, idx) => {
        const pts = DAILY_RANK_POINTS[idx] || 0;
        if (!pts || !row?.name) return;
        if (!playerDayPoints.has(row.name)) playerDayPoints.set(row.name, new Map());
        const dayMap = playerDayPoints.get(row.name);
        dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + pts);
      });
    });

    const bonus = {};
    playerDayPoints.forEach((dayMap, name) => {
      let weekly = 0;
      dayMap.forEach(pts => { weekly += Math.min(pts, DAILY_BONUS_PER_DAY_CAP); });
      bonus[name] = Math.min(weekly, DAILY_BONUS_WEEK_CAP);
    });

    return new Response(JSON.stringify({ ok: true, bonus }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (e) {
    return Response.json({ ok: false, error: 'server_error', detail: e?.message || String(e) }, { status: 500 });
  }
}
