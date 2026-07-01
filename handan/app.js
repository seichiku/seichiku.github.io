// ============================================================
// 判断データベース LP — メインアプリケーション
// 植田 公開判断ミラー（顧客No.等を除外したSS）を読み、
// 成長ランキング＋植田の公開判断を表示する。@seichiku.org ログイン限定。
//
// 認証は Google Sign-In（ID確認）のみ。スプレッドシートの読み取りは
// Apps Script ウェブアプリ経由で行い、ブラウザには機密スコープを一切
// 要求しない（＝「このアプリはGoogleで確認されていません」警告を回避）。
// ============================================================

let handanRecords = [];   // 植田の公開判断
let growthRanking = [];   // 成長ランキング

// ── Google Sign-In（ID token）──
window.onload = function () {
  if (!CONFIG.GOOGLE_CLIENT_ID || CONFIG.GOOGLE_CLIENT_ID.indexOf('YOUR_') === 0) {
    showLoginError('config.js の GOOGLE_CLIENT_ID を設定してください');
    return;
  }
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.indexOf('YOUR_') === 0) {
    showLoginError('config.js の APPS_SCRIPT_URL を設定してください');
    return;
  }

  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: false,
  });
  google.accounts.id.renderButton(
    document.getElementById('googleSignInBtn'),
    { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', shape: 'pill', locale: 'ja' }
  );

  const searchEl = document.getElementById('handanSearch');
  if (searchEl) searchEl.addEventListener('input', filterHandan);
};

async function handleCredential(response) {
  const credential = response && response.credential;
  if (!credential) {
    showLoginError('ログインに失敗しました。もう一度お試しください。');
    return;
  }

  // クライアント側の早期チェック（正式な検証は Apps Script 側で実施）
  const claims = decodeJwt(credential);
  if (claims && CONFIG.ALLOWED_DOMAINS.length > 0) {
    const domain = (claims.email || '').split('@')[1];
    if (!CONFIG.ALLOWED_DOMAINS.includes(domain)) {
      showLoginError(`${domain} ドメインではログインできません。@seichiku.org アカウントを使用してください。`);
      google.accounts.id.disableAutoSelect();
      return;
    }
  }

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userInfo').innerHTML = `
    <img src="${(claims && claims.picture) || ''}" alt="" class="user-avatar">
    <span class="user-name">${escHtml((claims && claims.name) || '')}</span>
    <button class="logout-btn" onclick="logout()">ログアウト</button>
  `;

  await loadData(credential);
}

function logout() {
  google.accounts.id.disableAutoSelect();
  handanRecords = [];
  growthRanking = [];
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.style.display = 'block';
}

// JWT（ID token）のペイロードをデコード（署名検証はサーバー側で実施）
function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

// ── Data Loading ──
// Apps Script ウェブアプリに ID token を渡し、公開判断＋成長ランキングを取得する。
// Content-Type を text/plain にすることで CORS プリフライト（OPTIONS）を回避する。
async function fetchFromAppsScript(credential) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: credential,
  });
  if (!res.ok) throw new Error('サーバーへの接続に失敗しました');
  return res.json();
}

async function loadData(credential) {
  const loading = document.getElementById('loadingIndicator');
  loading.style.display = 'flex';
  try {
    const data = await fetchFromAppsScript(credential);

    if (!data || !data.ok) {
      const code = data && data.error;
      if (code === 'domain_forbidden' || code === 'aud_mismatch' ||
          code === 'invalid_token' || code === 'email_unverified') {
        // 認証系エラー：ログイン画面へ戻す
        document.getElementById('mainApp').style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
        showLoginError('ログインが確認できませんでした。@seichiku.org アカウントで再度お試しください。');
        google.accounts.id.disableAutoSelect();
        return;
      }
      throw new Error(code || 'データの取得に失敗しました');
    }

    // 公開判断（植田）
    const jCfg = CONFIG.SHEETS.PUBLIC_JUDGMENT;
    const jc = jCfg.columns;
    const jRows = data.publicJudgment || [];
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
    const rRows = data.growthRanking || [];
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
