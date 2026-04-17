// Cloudflare Pages 미들웨어
// ?ch_score=&ch_from= 파라미터가 있는 도전장 링크에 대해 OG 태그를 동적으로 교체합니다.

const GAME_CATALOG = {
  bacteria:  { title: "세균전",              scoreLabel: v => `${v}칸` },
  starblitz: { title: "스타블리츠",           scoreLabel: v => `${Math.round(+v)}점` },
  breakout:  { title: "벽돌깨기",            scoreLabel: v => `${Math.round(+v)}점` },
  reaction:  { title: "반응속도 테스트",      scoreLabel: v => `${(+v).toFixed(1)}ms` },
  memory:    { title: "색상 기억 게임",       scoreLabel: v => `${v}라운드` },
  stopbar:   { title: "정지 타이밍 게임",     scoreLabel: v => `${v}연속` },
  snake:     { title: "스네이크",             scoreLabel: v => `${Math.round(+v)}점` },
};

function escapeHtml(str) {
  return String(str).replace(/[<>"&]/g, c => ({ '<':'&lt;', '>':'&gt;', '"':'&quot;', '&':'&amp;' }[c]));
}

export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  // API 요청은 통과
  if (url.pathname.startsWith('/api/')) return next();

  const chScore = url.searchParams.get('ch_score');
  const chFrom  = url.searchParams.get('ch_from');

  // 도전장 파라미터가 없으면 통과
  if (!chScore || !chFrom) return next();

  // 게임 페이지 확인: /click10/ → click10
  const gameId = url.pathname.replace(/^\/|\/$/g, '').split('/')[0];
  const game = GAME_CATALOG[gameId];
  if (!game) return next();

  const score = parseFloat(chScore);
  if (isNaN(score)) return next();

  const from      = escapeHtml(String(chFrom).slice(0, 25));
  const scoreText = escapeHtml(game.scoreLabel(score));
  const dynTitle  = `${from}의 도전장! | DailyGames`;
  const dynDesc   = `${game.title}에서 ${scoreText} 기록했어요. 이길 수 있어? 🎮`;

  const response = await next();
  const html = await response.text();

  const modified = html
    .replace(/(<meta property="og:title" content=")[^"]*(")/,        `$1${dynTitle}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/,  `$1${dynDesc}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/,       `$1${dynTitle}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/,`$1${dynDesc}$2`);

  return new Response(modified, {
    status: response.status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
