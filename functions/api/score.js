// 점수 저장 API
// 닉네임 필터 검증 후 scores 테이블에 기록을 추가합니다.
function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function validMode(mode) {
  return mode === "daily" || mode === "weekly";
}

const BANNED_NICK_TOKENS = [
  "씨발","시발","ㅅㅂ","ㅂㅅ","병신","좆","존나","개새끼","지랄",
  "섹스","자지","보지","성교","강간","애널","porn","sex","fuck","shit","bitch"
];

function normalizeForNickFilter(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\-_.,~!@#$%^&*()+=[\]{}:;"'`|\\/<>?]+/g, "");
}

function isNicknameAllowed(name) {
  const n = normalizeForNickFilter(name);
  return !BANNED_NICK_TOKENS.some((token) => n.includes(token));
}

export async function onRequestPost(context) {
  try {
    if (!context.env || !context.env.DB) {
      return json({ ok: false, error: "db_binding_missing" }, { status: 500 });
    }

    const body = await context.request.json();
    const gameId    = String(body.gameId    || "").trim();
    const mode      = String(body.mode      || "").trim();
    const periodKey = String(body.periodKey || "").trim();
    const name      = String(body.name      || "").trim().slice(0, 20) || "anonymous";
    const score     = Number(body.score);
    const sort      = String(body.sort      || "desc").trim() === "asc" ? "asc" : "desc";
    const gameTitle = String(body.gameTitle || gameId).trim().slice(0, 30);

    // 기본 페이로드 검증
    if (!gameId || !validMode(mode) || !periodKey || !Number.isFinite(score)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    // 부적절 닉네임 차단
    if (!isNicknameAllowed(name)) {
      return json({ ok: false, error: "invalid_name" }, { status: 400 });
    }

    const db = context.env.DB;
    const best  = sort === "asc" ? "MIN(score)" : "MAX(score)";
    const order = sort === "asc" ? "ASC" : "DESC";
    const rankSql = `WITH f AS (SELECT name,score,created_at FROM scores WHERE game_id=?1 AND mode='daily' AND period_key=?2),
      b AS (SELECT name,${best} AS bs FROM f GROUP BY name),
      p AS (SELECT f.name,b.bs AS score,MIN(f.created_at) AS ca FROM f JOIN b ON b.name=f.name AND b.bs=f.score GROUP BY f.name,b.bs)
      SELECT name FROM p ORDER BY score ${order},ca ASC LIMIT 50`;

    // 추월 감지: 저장 전 랭킹 조회
    const oldRows = mode === "daily"
      ? ((await db.prepare(rankSql).bind(gameId, periodKey).all()).results || [])
      : [];
    const oldRank = oldRows.findIndex(r => r.name === name);

    await db.prepare(
      "INSERT INTO scores (game_id, mode, period_key, name, score) VALUES (?1, ?2, ?3, ?4, ?5)"
    ).bind(gameId, mode, periodKey, name, score).run();

    // 저장 후 랭킹 조회 → 추월된 플레이어 계산
    let overtook = [];
    if (mode === "daily") {
      const newRows = (await db.prepare(rankSql).bind(gameId, periodKey).all()).results || [];
      const newRank = newRows.findIndex(r => r.name === name);
      if (newRank >= 0) {
        if (oldRank >= 0 && newRank < oldRank) {
          overtook = oldRows.slice(newRank, oldRank).map(r => r.name).filter(n => n !== name).slice(0, 3);
        } else if (oldRank < 0 && newRank < oldRows.length) {
          const beaten = oldRows[newRank];
          if (beaten && beaten.name !== name) overtook = [beaten.name];
        }
      }
    }

    return json({ ok: true, overtook });
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
