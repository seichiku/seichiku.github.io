// ============================================================
// 判断データベース — データ中継API（Google Apps Script ウェブアプリ）
//
// 目的：
//   ブラウザ側に spreadsheets 権限（機密スコープ）を要求せずにミラーSSを読む。
//   これにより「このアプリはGoogleで確認されていません」警告を回避する。
//
// 仕組み：
//   1. ブラウザは「Googleでログイン」で得た ID token（JWT）を POST する。
//   2. ここで ID token を検証（署名・有効期限・aud・ドメイン）。
//   3. @seichiku.org の正規ユーザーだけに、ミラーSSの中身をJSONで返す。
//   読み取りはデプロイ主（＝ミラー所有者）の権限で行うため、
//   各ユーザーへのSS共有は不要。
//
// デプロイ手順は同フォルダの README.md を参照。
// ============================================================

// このウェブアプリを呼び出せる OAuth クライアントID（サイト側と一致させる）
var CLIENT_ID = '248673786507-mdqci7it6nokcerj001k226k6fungjeu.apps.googleusercontent.com';

// ログインを許可するドメイン
var ALLOWED_DOMAIN = 'seichiku.org';

// 植田 公開判断ミラー スプレッドシートID（config.js の MIRROR_SPREADSHEET_ID と同じ）
var SHEET_ID = '17L_Bx75HJT1uv-DibxhwfCTU6vvEn3SLuBBHGBMYv3k';

// 読み取るシート名
var SHEET_PUBLIC_JUDGMENT = '公開判断';
var SHEET_GROWTH_RANKING  = '成長ランキング';

function doPost(e) {
  try {
    var idToken = (e && e.postData && e.postData.contents ? e.postData.contents : '').trim();
    var claims = verifyIdToken_(idToken);
    if (!claims) return json_({ ok: false, error: 'invalid_token' });

    // aud（発行先クライアント）の一致を確認
    if (claims.aud !== CLIENT_ID) return json_({ ok: false, error: 'aud_mismatch' });

    // メール確認済みか
    if (String(claims.email_verified) !== 'true') return json_({ ok: false, error: 'email_unverified' });

    // ドメイン制限
    var email = claims.email || '';
    var domain = email.split('@')[1];
    if (ALLOWED_DOMAIN && domain !== ALLOWED_DOMAIN) {
      return json_({ ok: false, error: 'domain_forbidden', domain: domain });
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    return json_({
      ok: true,
      user: { name: claims.name || '', email: email, picture: claims.picture || '' },
      publicJudgment: readSheet_(ss, SHEET_PUBLIC_JUDGMENT),
      growthRanking:  readSheet_(ss, SHEET_GROWTH_RANKING),
    });
  } catch (err) {
    return json_({ ok: false, error: 'server_error', message: String(err) });
  }
}

// 動作確認用（ブラウザで /exec を開いたときの応答）
function doGet() {
  return json_({ ok: true, msg: '判断DB API. POST an id_token as the request body.' });
}

// ID token を Google の tokeninfo で検証（署名・有効期限もここで担保される）
function verifyIdToken_(idToken) {
  if (!idToken) return null;
  var url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

// シートを2次元配列（表示値の文字列）で返す。存在しなければ空配列。
function readSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var range = sh.getDataRange();
  if (!range) return [];
  return range.getDisplayValues();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
