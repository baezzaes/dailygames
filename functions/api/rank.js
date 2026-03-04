// deploy: trigger rebuild
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

    const order = sort === "asc" ? "ASC" : "DESC";
    const { results } = await context.env.DB.prepare(
      `SELECT name, score, created_at
       FROM scores
       WHERE game_id = ?1 AND mode = ?2 AND period_key = ?3
       ORDER BY score ${order}, created_at ASC
       LIMIT ?4`
    )
      .bind(gameId, mode, periodKey, limit)
      .all();

    return json({ ok: true, rows: results || [] });
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

