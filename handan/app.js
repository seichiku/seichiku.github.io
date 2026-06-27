// ============================================================
// 判断データベース LP — メインアプリケーション
// 植田 公開判断ミラー（顧客No.等を除外したSS）を読み、
// 成長ランキング＋植田の公開判断を表示する。@seichiku.org ログイン限定。
// ============================================================

let accessToken = null;
let handanRecords = [];   // 植田の公開判断
let growthRanking = [];   // 成長ランキング
let tokenClient;

// ── Google Sign-In ──
window.onload = function () {
  if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.indexOf('YOUR_') === 0) {
    showLoginError('config.js の GOOGLE_CLIENT_ID を設定してください');
    return;
  }

  google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    callback: handleTokenResponse,
    error_callback: (err) => showLoginError('ログインに失敗しました: ' + (err.message || err.type)),
  });

  document.getElementById('googleSignInBtn').innerHTML = `
    <button class="google-btn" onclick="requestLogin()">
      <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
      Googleアカウントでログイン
    </button>
  `;

  const searchEl = document.getElementById('handanSearch');
  if (searchEl) searchEl.addEventListener('input', filterHandan);
};

function requestLogin() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    callback: handleTokenResponse,
  });
  tokenClient.requestAccessToken();
}

async function handleTokenResponse(response) {
  if (response.error) {
    showLoginError('認証エラー: ' + response.error);
    return;
  }
  accessToken = response.access_token;

  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const user = await userRes.json();

    if (CONFIG.ALLOWED_DOMAINS.length > 0) {
      const domain = (user.email || '').split('@')[1];
      if (!CONFIG.ALLOWED_DOMAINS.includes(domain)) {
        showLoginError(`${domain} ドメインではログインできません。@seichiku.org アカウントを使用してください。`);
        accessToken = null;
        return;
      }
    }

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userInfo').innerHTML = `
      <img src="${user.picture || ''}" alt="" class="user-avatar">
      <span class="user-name">${escHtml(user.name || '')}</span>
      <button class="logout-btn" onclick="logout()">ログアウト</button>
    `;

    await loadData();
  } catch (err) {
    showLoginError('ユーザー情報の取得に失敗しました');
  }
}

function logout() {
  const t = accessToken;
  accessToken = null;
  if (t) google.accounts.oauth2.revoke(t);
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// ── Data Loading ──
async function fetchSheet(spreadsheetId, sheetName, range) {
  const fullRange = `${sheetName}!${range}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(fullRange)}`;
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'シートの読み込みに失敗');
  }
  const data = await res.json();
  return data.values || [];
}

async function loadData() {
  const loading = document.getElementById('loadingIndicator');
  loading.style.display = 'flex';
  try {
    // 公開判断（植田）
    const jCfg = CONFIG.SHEETS.PUBLIC_JUDGMENT;
    const jc = jCfg.columns;
    const jRows = await fetchSheet(CONFIG.MIRROR_SPREADSHEET_ID, jCfg.name, jCfg.range);
    handanRecords = (jRows.length <= 1 ? [] : jRows.slice(1))
      .filter(row => (row[jc.staff] || '').trim() !== '')   // ヘッダ/プレースホルダ除外
      .map(row => ({
        date: row[jc.date] || '', staff: row[jc.staff] || '', clinic: row[jc.clinic] || '',
        problemNo: row[jc.problemNo] || '', type: row[jc.type] || '',
        hypothesis: row[jc.hypothesis] || '', evidence: row[jc.evidence] || '', reason: row[jc.reason] || '',
        risk: row[jc.risk] || '', alt: row[jc.alt] || '',
        checkPrev: row[jc.checkPrev] || '', checkGap: row[jc.checkGap] || '',
        newHypothesis: row[jc.newHypothesis] || '', newEvidence: row[jc.newEvidence] || '',
        newReason: row[jc.newReason] || '', newRisk: row[jc.newRisk] || '', newAlt: row[jc.newAlt] || '',
        churnWhy: row[jc.churnWhy] || '', churnPivot: row[jc.churnPivot] || '', churnNext: row[jc.churnNext] || '',
        uedaComment: row[jc.uedaComment] || '', gapImprove: row[jc.gapImprove] || '', commentReflect: row[jc.commentReflect] || '',
      }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 成長ランキング（先頭のタイトル/注記行を除外）
    const rCfg = CONFIG.SHEETS.GROWTH_RANKING;
    const rc = rCfg.columns;
    const rRows = await fetchSheet(CONFIG.MIRROR_SPREADSHEET_ID, rCfg.name, rCfg.range);
    growthRanking = rRows
      .filter(row => {
        const name = (row[rc.staff] || '').trim();
        if (!name || name.indexOf('担当者') >= 0 || name.indexOf('成長ランキング') >= 0 || name.indexOf('※') === 0) return false;
        return !isNaN(parseFloat(row[rc.rank])) || !isNaN(parseFloat(row[rc.scoreNow]));
      })
      .map(row => ({
        staff: row[rc.staff] || '',
        scoreNow: parseFloat(row[rc.scoreNow]) || 0,
        scorePrev: parseFloat(row[rc.scorePrev]) || 0,
        delta: parseFloat(row[rc.delta]) || 0,
        rank: parseInt(row[rc.rank], 10) || 0,
      }))
      .sort((a, b) => (b.delta - a.delta) || (b.scoreNow - a.scoreNow));
  } catch (err) {
    console.warn('判断データの読み込みに失敗:', err.message);
    handanRecords = [];
    growthRanking = [];
  } finally {
    loading.style.display = 'none';
  }

  renderGrowthRanking();
  filterHandan();
}

// ── 成長ランキング ──
function renderGrowthRanking() {
  const box = document.getElementById('growthRanking');
  if (!box) return;
  if (growthRanking.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>ランキングデータがまだありません</p></div>';
    return;
  }
  box.innerHTML = growthRanking.map((g, i) => {
    const sign = g.delta > 0 ? '+' : '';
    const detail = `今月スコア ${g.scoreNow}（前月 ${g.scorePrev}）`;
    return `
      <div class="ranking-item">
        <div class="rank">${i + 1}</div>
        <div class="info">
          <div class="name">${escHtml(g.staff)}</div>
          <div class="detail">${escHtml(detail)}</div>
        </div>
        <div style="text-align:right">
          <div class="count">${sign}${g.delta}</div>
          <div class="count-label">伸び</div>
        </div>
      </div>`;
  }).join('');
}

// ── 植田の公開判断 ──
function filterHandan() {
  const el = document.getElementById('handanGrid');
  if (!el) return;
  const query = (document.getElementById('handanSearch')?.value || '').toLowerCase();
  const filtered = handanRecords.filter(r => {
    if (!query) return true;
    return [r.staff, r.clinic, r.type, r.hypothesis, r.evidence, r.reason, r.risk, r.alt,
            r.checkGap, r.newHypothesis, r.churnWhy, r.uedaComment]
      .some(v => (v || '').toLowerCase().includes(query));
  });

  const countEl = document.getElementById('handanCount');
  if (countEl) countEl.textContent = `${filtered.length} 件の判断`;

  const empty = document.getElementById('handanEmpty');
  if (filtered.length === 0) {
    el.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  el.innerHTML = filtered.map(handanCardHtml).join('');
}

function handanCardHtml(r) {
  const typeBadge = r.type ? `<span class="category-badge">${escHtml(r.type)}</span>` : '';
  const meta = `${escHtml(r.date)} ｜ ${escHtml(r.staff)}（${escHtml(r.clinic)}）${r.problemNo ? ' ｜ ' + escHtml(r.problemNo) + 'つ目の悩み' : ''}`;

  const story = [
    storyStep('💭 仮説（原因を何と読んだか）', r.hypothesis),
    storyStep('🔎 根拠（何を見て/聞いて/触れて）', r.evidence),
    storyStep('🩹 施術を選んだ理由', r.reason),
    storyStep('⚠️ リスク／失敗条件', r.risk),
    storyStep('🔀 別案', r.alt),
    storyStep('↩️ 答え合わせ：前回の仮説どうだった', r.checkPrev),
    storyStep('📐 予想とのズレ', r.checkGap),
    storyStep('🆕 次の悩みの仮説', r.newHypothesis),
    storyStep('🔎 その根拠', r.newEvidence),
    storyStep('🩹 施術を選んだ理由', r.newReason),
    storyStep('🚪 なぜ離反したと思うか', r.churnWhy),
    storyStep('🧭 分岐点だった判断', r.churnPivot),
    storyStep('🔁 次に同じ状況ならどう変えるか', r.churnNext),
  ].join('');

  const chips = [];
  if (String(r.gapImprove).trim() !== '') chips.push(`<span class="score-chip">ギャップ改善 ${escHtml(r.gapImprove)}</span>`);
  if (String(r.commentReflect).trim() !== '') chips.push(`<span class="score-chip">添削反映 ${escHtml(r.commentReflect)}</span>`);
  const scoreHtml = chips.length ? `<div class="score-row">${chips.join('')}</div>` : '';

  const commentHtml = r.uedaComment ? `
    <div class="joy-voice">
      <div class="joy-label">✏️ 植田添削</div>
      <p>${escHtml(r.uedaComment)}</p>
    </div>` : '';

  return `
    <div class="case-card">
      <div class="case-head">
        ${typeBadge}
        <span class="case-meta">${meta}</span>
      </div>
      <div class="story">${story}</div>
      ${commentHtml}
      ${scoreHtml}
    </div>`;
}

function storyStep(label, text) {
  if (!text || !String(text).trim()) return '';
  return `<div class="story-step"><div class="step-label">${label}</div><div class="step-text">${escHtml(text)}</div></div>`;
}

// ── Utility ──
function escHtml(str) {
  if (str === null || str === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}
