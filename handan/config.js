// ============================================================
// 判断データベース LP — 設定ファイル
// ============================================================

const CONFIG = {
  // Google OAuth Client ID（みんなの実績と同一・同一オリジンで流用可）
  // ※ ID確認（Sign in with Google）専用に使用。機密スコープは要求しないため
  //    「このアプリはGoogleで確認されていません」警告は表示されない。
  GOOGLE_CLIENT_ID: '248673786507-mdqci7it6nokcerj001k226k6fungjeu.apps.googleusercontent.com',

  // Apps Script ウェブアプリのURL（データ中継API）
  // handan/apps-script/Code.gs をデプロイして得た /exec URL を貼る。
  // スプレッドシートの読み取りはこのサーバー側で行い、ブラウザには
  // spreadsheets 権限を一切要求しない（＝未確認アプリ警告を回避）。
  APPS_SCRIPT_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL',

  // ログインを許可するドメイン（空配列 [] なら全Googleアカウント許可）
  // ※ 正式な判定は Apps Script 側でも行う（クライアント側は早期チェック用）。
  ALLOWED_DOMAINS: ['seichiku.org'],

  // 植田 公開判断ミラー スプレッドシートID
  // 判断ログDB（非公開・竹中＋植田）から「公開用（植田）」「成長ランキング」だけを
  // IMPORTRANGE で写したミラー。顧客No.等の患者特定情報はミラー時点で除外済み。
  // ※ 読み取りは Apps Script（デプロイ主＝ミラー所有者の権限）で行うため、
  //    各ログインユーザーへの個別共有は不要。この ID は Apps Script 側にも設定する。
  MIRROR_SPREADSHEET_ID: '17L_Bx75HJT1uv-DibxhwfCTU6vvEn3SLuBBHGBMYv3k',

  SHEETS: {
    // 植田の公開判断（教材）
    PUBLIC_JUDGMENT: {
      name: '公開判断',
      range: 'A:X',
      columns: {
        timestamp: 0,
        date: 1,           // 施術日
        staff: 2,          // 担当者
        clinic: 3,         // 院
        problemNo: 4,      // 何個目の悩み？
        type: 5,           // 種別（初再診/転機/離反）
        hypothesis: 6,     // 仮説：原因を何だと読んだ？
        evidence: 7,       // 根拠
        reason: 8,         // 施術を選んだ理由
        risk: 9,           // リスク／失敗条件
        alt: 10,           // 別案
        checkPrev: 11,     // 前回の仮説、実際どうだった？
        checkGap: 12,      // 予想とのズレは？
        newHypothesis: 13, // 次の悩みの仮説
        newEvidence: 14,   // その根拠
        newReason: 15,     // 施術を選んだ理由
        newRisk: 16,       // リスク
        newAlt: 17,        // 別案
        churnWhy: 18,      // なぜ離反したと思う？
        churnPivot: 19,    // どの判断が分岐点だった？
        churnNext: 20,     // 次に同じ状況なら
        uedaComment: 21,   // 植田添削（コメント）
        gapImprove: 22,    // ギャップ改善(-2〜+2)
        commentReflect: 23,// 添削反映(0〜2)
      }
    },
    // 成長ランキング（前月比の伸びで順位・正直さは点数化しない）
    // 先頭にタイトル/注記行があるため、データ行は parse 側で判定する
    GROWTH_RANKING: {
      name: '成長ランキング',
      range: 'A:G',
      columns: {
        staff: 0,      // 担当者
        gapAvg: 1,     // 今月 ギャップ改善(平均)
        reflectAvg: 2, // 今月 添削反映(平均)
        scoreNow: 3,   // 今月 成長スコア
        scorePrev: 4,  // 前月 成長スコア
        delta: 5,      // 伸び(Δ)
        rank: 6,       // 順位
      }
    }
  },
};
