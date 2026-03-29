function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

function validMode(mode) {
  return mode === "daily" || mode === "weekly";
}

export async function onRequestPost(context) {
  try {
    if (!context.env || !context.env.DB) {
      return json({ ok: false, error: "db_binding_missing" }, { status: 500 });
    }

    const body = await context.request.json();
    const gameId = String(body.gameId || "").trim();
    const mode = String(body.mode || "").trim();
    const periodKey = String(body.periodKey || "").trim();
    const name = String(body.name || "").trim().slice(0, 20) || "anonymous";
    const score = Number(body.score);

    if (!gameId || !validMode(mode) || !periodKey || !Number.isFinite(score)) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await context.env.DB.prepare(
      "INSERT INTO scores (game_id, mode, period_key, name, score) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(gameId, mode, periodKey, name, score)
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
