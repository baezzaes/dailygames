# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

출퇴근/점심 짬에 즐기는 모바일 미니게임 허브. Cloudflare Pages + D1(SQLite) 기반으로 배포되며, 빌드 단계 없이 정적 파일을 그대로 서빙한다.

## 배포

- `main` 브랜치 push → Cloudflare Pages 자동 배포 (1~2분 소요)
- GitHub Actions 없음
- 로컬 개발 서버 없음 — 파일 수정 후 push해서 CF Pages에서 확인

## 버전 관리 규칙

**모든 커밋 시 `index.html` 하단의 버전 표시를 반드시 함께 업데이트한다.**

```
v(major).(minor).(patch)
```

- **patch** (x.x.+1): 버그 수정, 밸런스 조정, 캐시 버스팅
- **minor** (x.+1.0): 게임 추가, 신규 기능, 아이템 추가, UI 개선
- **major** (+1.0.0): 구조적 전면 개편

## 캐시 버스팅

게임 파일(JS/CSS) 수정 시 해당 게임의 `index.html`에서 스크립트/스타일 로드 쿼리를 올려야 한다.

```html
<script src="../game.js?v=YYYYMMDD-N"></script>
<script src="./app.js?v=YYYYMMDD-N"></script>
```

날짜가 같은 날 여러 번 수정할 경우 `-2`, `-3` 등 suffix를 붙인다.

## 아키텍처

### 프론트엔드 구조

```
index.html          허브 (닉네임 입력 + 게임 선택)
style.css           허브 전용 스타일
shared.css          모든 게임 공통 스타일 (버튼, 카드, 랭킹, 결과 배너 등)
game.js             모든 게임 공통 로직
  - GAME_CATALOG    게임 목록 (다음 게임 추천에 사용)
  - addRecord()     점수 서버 저장 + 랭킹 UI 갱신
  - showResultBanner() 결과 배너 표시 + 자동 스크롤
  - updateRankUI()  랭킹 목록 렌더링
  - getPlayerName() 닉네임#태그 반환

[game]/index.html   각 게임 페이지
[game]/app.js       게임 로직 (GAME_ID, GAME_TITLE, RANK_SORT, scoreLabel 전역 필수)
[game]/style.css    게임 전용 스타일
```

### 게임별 app.js 필수 전역

```js
const GAME_ID    = "gameId";        // API 식별자
const GAME_TITLE = "게임 이름";
const RANK_SORT  = "desc";          // or "asc"
const scoreLabel = (v) => `${v}점`; // 점수 포맷 함수
```

### 게임 로드 순서

```html
<script src="../game.js?v=..."></script>  <!-- 먼저 로드 -->
<script src="./app.js?v=..."></script>    <!-- 이후 로드 -->
```

`game.js`가 먼저 로드되어야 `GAME_CATALOG`, `addRecord`, `showResultBanner` 등을 사용할 수 있다.

### 백엔드 (Cloudflare Pages Functions)

```
functions/
  _middleware.js      도전장 링크 OG 태그 동적 교체
  api/
    score.js          POST /api/score — 점수 저장
    rank.js           GET /api/rank — 랭킹 조회 (daily/weekly)
    admin.js          관리자 전용
```

**DB**: Cloudflare D1 (SQLite). 스키마는 `schema.sql` 참고.
- `scores` 테이블: `game_id, mode, period_key, name, score, created_at`
- `period_key`: daily → `YYYY-MM-DD`, weekly → `YYYY-Www` (KST 기준)
- 랭킹 규칙: 닉네임당 최고 기록 1개, 동점 시 `created_at` 빠른 순

### 닉네임 체계

- 형식: `닉네임#태그` (예: `홍길동#A3F2`)
- 태그는 `localStorage.getItem('dailygames:lasttag')`에 저장된 4자리 hex
- 닉네임은 `localStorage.getItem('dailygames:lastname')`
- 비속어 필터링: `game.js`와 `functions/` 양쪽에 동일 목록 유지

### localStorage 키 규칙

- `dailygames:lastname` — 닉네임
- `dailygames:lasttag` — 태그
- `dailygames:{gameId}:pb` — 게임별 개인 최고 기록
- `dailygames:streak:count/lastdate/max` — 연속 플레이 스트릭

## 신규 게임 추가 체크리스트

1. `[gameId]/` 폴더 생성 (index.html, app.js, style.css)
2. `game.js`의 `GAME_CATALOG` 배열에 항목 추가
3. `index.html` 허브에 메뉴 카드 추가 (PB_GAMES, RANK_GAMES, pbReset 포함)
4. `style.css`에 필요한 `.menu-badge` 색상 클래스 추가
5. `functions/_middleware.js`의 `GAME_CATALOG`에 추가
6. 버전 minor 업 (x.+1.0)
