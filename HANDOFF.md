# HANDOFF — Train Live Map 京急線版（非公式）

更新日: 2026-07-30

## 絶対に守る分離

- 新規GitHubリポジトリ: `shunsoco-stack/train-live-map-keikyu`
- 新規Vercelプロジェクト: `train-live-map-keikyu`。既存JR東日本版のVercelプロジェクト `train-live-map` とリンクしない
- VercelのGit連携、deployment履歴、ドメイン、Project Environment Variablesを既存JR東日本版と共有しない
- 京急版専用KV: 既存版のURL・トークン・データベースを再利用しない
- 京急版専用VAPID鍵ペア: 公開鍵／秘密鍵とも新規生成
- 秘密値は開発時の `.env.local` または京急版VercelプロジェクトのEnvironment Variablesだけへ保存し、Team Shared Environment Variablesを使わない
- Firebase App Hostingを代替経路として使う場合だけ、秘密値をFirebase Cloud Secret Managerへ保存する
- `firebase.json`、`.firebaserc`、`apphosting.yaml` はFirebase代替設定として残す。`apphosting.yaml` へ秘密値そのものを記録しない
- 既存 `train-live-map` リポジトリへcommit・pushしない

このディレクトリは `main` ブランチの独立したGitリポジトリとして初期化済みで、`origin` は `https://github.com/shunsoco-stack/train-live-map-keikyu.git` を指しています。commit・push前に、現在地とremote先を毎回再確認してください。

## 実装済みの分離

| 対象 | 京急版namespace |
| --- | --- |
| 利用者投稿KV | `train-live-map-keikyu:community:reports:v1` |
| Push購読KV | `train-live-map-keikyu:community:push-subscriptions:v1` |
| 投稿端末localStorage | `train-live-map-keikyu:community:reporter:v1` |
| Push路線localStorage | `train-live-map-keikyu:community:push-lines:v1` |
| 表示路線localStorage | `train-live-map-keikyu:visible-lines` |
| お気に入り路線localStorage | `train-live-map-keikyu:favorite-lines` |
| Xブラウザー案内localStorage | `train-live-map-keikyu:browser:x-guidance:v1` |
| Safari案内localStorage | `train-live-map-keikyu:browser:safari-install-dismissed:v1` |
| 投稿者hash | namespaceを含むseed |
| 投稿ネットワークhash | namespaceとサーバー秘密値を使うHMAC（生IPは保存・ログ出力しない） |
| Push購読hash | namespaceを含むseed |
| Push tag/topic | namespaceを含む |

サーバー側は `KV_REST_API_URL` / `KV_REST_API_TOKEN` だけを参照します。旧 `UPSTASH_REDIS_REST_*` への暗黙フォールバックはありません。

VAPIDは以下の4変数が揃い、2つの公開鍵が一致した場合だけ有効になります。

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

未設定・不一致時も `/sw.js` は登録され、PWA機能とPush機能を分離します。

## デザインとアクセシビリティ

- M PLUS Rounded 1cを全画面で使用
- 明るい地図＋暖色白の素材面を基本にし、京急赤は列車・選択・主要操作へ限定
- ヘッダー、最重要の運行状況、下部の操作ドックという3階層に整理
- 列車フィルターは「すべて／遅延／運転見合わせ」を先頭にし、横スクロール内へ閉じ込める
- 共通`AccessibleSheet`はネイティブ`dialog`を使い、Escape、外側タップ、初期フォーカス、起点へのフォーカス復帰へ対応
- 実装していないドラッグ操作を示す偽のハンドルは表示しない
- 主要操作とMapLibre操作は44px以上
- 320 / 375 / 393 / 430pxで、ページの横はみ出しなし・主要操作の44px以上をProductionビルドで確認
- 広告はClient IDとslotが両方設定されたときだけ領域を確保

## 外部作業

1. GitHub側でVercel GitHub Appのsudo再認証を完了する。2026年7月30日時点ではこの再認証待ちで、自動連携は未完了。
2. Vercelへ新規GitHubリポジトリ `shunsoco-stack/train-live-map-keikyu` だけをimportし、新規プロジェクト `train-live-map-keikyu` を作成する。既存の `train-live-map` プロジェクトは変更しない。
3. Node.js 22.xとNext.jsの自動検出を確認する。Build Commandは `npm run build`、追加の `vercel.json` は不要。
4. VercelのProductionとPreviewへ、`ODPT_API_BASE_URL=https://api-challenge.odpt.org/api/v4` と `ODPT_LIVE_DATA_APPROVED=false` だけをProject Environment Variablesとして設定する。
5. `ODPT_ACCESS_TOKEN`、KV、VAPID、`NEXT_PUBLIC_ADSENSE_CLIENT_ID`、`NEXT_PUBLIC_ADSENSE_BANNER_SLOT` が未設定であることを確認する。初回公開はmock-only、Push無効、AdSense無効。
6. 新しいPreviewとProduction deploymentを作成し、`/api/trains` が `source=mock`、`/dev/debug` と `/api/dev/debug` が404であることを確認する。
7. 公開URLを320 / 375 / 393 / 430pxとiPhoneホーム画面追加で確認する。
8. 特定利用条件の回答記録を保存した後、非公開の検証環境でChallenge APIを疎通確認する。実データをProductionへ出すまでは `ODPT_LIVE_DATA_APPROVED=false` を維持する。
9. KV、VAPID、AdSenseは、それぞれの利用条件・分離・費用を確認した後の別deploymentで段階的に有効化する。

### Vercel設定

- Project Name: `train-live-map-keikyu`
- Git Repository: `shunsoco-stack/train-live-map-keikyu`
- Framework Preset: Next.js（自動検出）
- Runtime: Node.js 22.x
- Build Command: `npm run build`
- Environment Variables: 京急版Project SettingsのProductionとPreview。Team Sharedは使わない
- 初回公開: `ODPT_API_BASE_URL` と `ODPT_LIVE_DATA_APPROVED=false` だけ
- ODPTトークン、KV、VAPID、AdSense: 未設定
- GitHub自動連携: GitHub側のsudo再認証待ち。完了後も新規リポジトリだけを接続する

### Firebase App Hosting設定（代替経路）

次のファイルとFirebaseプロジェクトは、Vercelを利用できない場合の代替設定です。削除はしませんが、現在の公開主経路ではなく、App Hosting backend作成とrolloutも未完了です。

- Firebase project ID: `train-live-map-keikyu`
- Firebase display name: `Train Live Map Keikyu`（Firebaseのプロジェクト名制約によりASCII表記）
- `firebase.json`: Backend ID `train-live-map-keikyu`、root `.`、秘密ファイル・生成物をアップロード対象外にする
- `.firebaserc`: default projectを `train-live-map-keikyu` に固定
- `apphosting.yaml`: `minInstances: 0`、`maxInstances: 2`
- 初回の非秘密値:
  - `ODPT_API_BASE_URL=https://api-challenge.odpt.org/api/v4`
  - `ODPT_LIVE_DATA_APPROVED=false`
- Region: `asia-east1`
- Runtime: バージョン固定Node.js runtimeとABIU
- App HostingはBlaze従量課金が必須。無料枠超過分は課金され、予算アラートは支出上限ではない
- Next.js 16.2.12は、Firebase公式のactive一覧（現在15.2系まで）より新しくpreview扱い。まず現行版でbuildし、互換性エラーが出た場合だけログに基づいてactive版への変更を判断する

2026-07-30に、既存版と分離したFirebaseプロジェクト `train-live-map-keikyu` を新規作成しました。Google Analyticsは無効、現在はSparkプランです。Vercel公開を主経路とし、Blazeへの変更、App Hostingバックエンド作成、rolloutは代替経路が必要になり、課金を明示確認した場合だけ行います。

## ODPT実データで確認する項目

- operator IDは `odpt.Operator:Keikyu` で応答するか
- 本線、空港線、大師線、逗子線、久里浜線の実際の路線ID
- 駅順、路線形状、上下方向
- `odpt:Train` と `odpt:TrainInformation`
- 列車種別、行先、遅延時間
- `dc:date`、`dct:valid`、`odpt:frequency`
- 品川〜泉岳寺間に列車を生成・描画していないこと

路線IDや欠落位置を名称から推測して本番固定しないでください。直通先も京急線内の提供範囲だけを表示します。

## ライセンス・クレジットの公開ブロッカー

公式確認先:

- https://challenge2026.odpt.org/
- https://ckan.odpt.org/dataset/keikyu__r_train_location
- https://developer.odpt.org/challenge_license
- https://developer.odpt.org/terms/data_basic_use_guideline.html

確認済み事項:

- Challenge実施期間: 2026-07-01〜2027-03-12
- 限定ライセンスの利用許諾終了: 2027-03-14
- 終了後は利用停止と限定データ削除が必要
- 日本時間2027-03-15 00:00以降は、サーバー側期限ゲートがトークンの有無にかかわらずODPT取得を停止
- `ODPT_LIVE_DATA_APPROVED=true` が明示されるまでは、トークンがあってもODPT取得を開始しない
- 品川〜泉岳寺間は列車ロケーション対象外
- アプリ問い合わせを京急電鉄へ直接送らない表示が必要
- 出典、正確性・完全性の非保証、動的データの生成時刻と鮮度表示が必要

未解決:

- 京急のデータセットは「特定利用条件」を参照するよう記載しているが、2026-07-29時点の限定ライセンスページには京急向け条項を確認できない。

対応:

- ODPT事務局へ特定利用条件の所在・適用内容を確認する。
- 回答日時、担当窓口、回答本文またはURLを非公開の運用記録へ保存する。
- 解消前は実データを使うProduction公開を完了扱いにしない。
- 2027-03-14までに停止／データ削除を行う運用タスクを登録する。

## PWA画像

原本と生成物:

- `public/icons/train-live-map-keikyu.svg`
- `public/icons/train-live-map-keikyu-192.png`
- `public/icons/train-live-map-keikyu-512.png`
- `public/icons/train-live-map-keikyu-maskable-512.png`
- `public/apple-touch-icon.png`
- `public/og-train-live-map-keikyu.png`
- `public/og.png`

公式ロゴは使用していません。再生成:

```bash
node scripts/generate-keikyu-icons.mjs
```

### App Router側の反映確認

App Routerが自動配信する次の画像も京急版へ置換済みです。

- `src/app/icon.png`
- `src/app/apple-icon.png`

次の参照も新しい京急版パスへ更新済みであることを確認しました。

- `src/app/manifest.ts`
- `src/app/layout.tsx`
- `src/components/AppHeader.tsx`
- `src/components/BrowserGuidance.tsx`

旧 `public` JR画像と旧生成スクリプトは削除済みです。今後の変更でも旧パスを戻さないでください。
manifestの `purpose: "maskable"` には
`/icons/train-live-map-keikyu-maskable-512.png` を指定し、通常の512pxアイコンと使い分けてください。

## AdSense

初回のmock-only公開では `NEXT_PUBLIC_ADSENSE_CLIENT_ID` と `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` をどちらも設定せず、広告スクリプト、`ads.txt`、広告領域を無効にします。将来、手動バナー広告を有効化する場合は、正式な `NEXT_PUBLIC_ADSENSE_CLIENT_ID` とGoogleが発行した実在のslot IDを `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` へ設定します。架空のslotは補いません。旧 `NEXT_PUBLIC_ADSENSE_CLIENT` は使用しません。詳細は `ADSENSE_SETUP.md` を参照してください。

## 検証

```bash
node scripts/generate-keikyu-icons.mjs
npm run lint
npm test
npm run build
```

追加確認:

- `rg -n "JR-East|jr-east|train-live-map:|UPSTASH_REDIS|NEXT_PUBLIC_ADSENSE_CLIENT(?!_ID)" .`
- Gitへ追加されるファイルに `.env`、鍵、トークンがない
- 「みんなの情報」と公式情報の見出し・出典が別
- 遅延時間なしの列車へ架空の分数が付かない
- VAPIDなしでもService Workerが登録される
- Push通知本文が「利用者投稿」「公式ではない」と明記する

### 2026-07-30 ローカル検証結果

- `package.json` / GitHub Actions: Node.js 22.xへ統一
- `npm run lint`: 成功
- `npm test`: 103 / 103成功
- `npm run build`: 成功（Next.js 16.2.12）
- 本番サーバーの `/`: HTTP 200
- 本番サーバーの `/api/trains`: 承認ゲート未解除時は `source=mock`、特定利用条件の確認待ちnotice
- 本番サーバーの `/dev/debug` / `/api/dev/debug`: HTTP 404
- 320 / 375 / 393 / 430px: document・地図・canvas幅がviewport幅と一致し、横はみ出しなし
- 4幅すべて「Train Live Map」「京急線版（非公式）」が省略なし
- ブラウザー操作: 路線検索、お気に入り登録／絞り込み、空港線だけへの切替、表示路線だけの運行情報を確認
- manifest、192 / 512 / maskable / Appleアイコン、Service Worker: HTTP 200
- ブラウザーconsole: error / warningなし
- 新規GitHubリポジトリへの初回push: 完了
- Vercel GitHub App自動連携: GitHub側のsudo再認証待ち
- 実API疎通、Vercelプロジェクト作成／deploy、公開URL実機確認は未完了
- Firebase App Hostingは代替経路として設定ファイルだけを保持し、backend作成／deployは未完了

## 完了判定

### mock-only初回公開

- lint / test / build成功
- 新規GitHubリポジトリへpush
- GitHub側のsudo再認証後、新規GitHubリポジトリだけを新規Vercelプロジェクトへ接続
- VercelのProductionとPreviewへ `ODPT_API_BASE_URL` と `ODPT_LIVE_DATA_APPROVED=false` だけを設定
- ODPTトークン、KV、VAPID、AdSenseを未設定のまま新規Vercelプロジェクトへdeploy
- `/api/trains` が `source=mock`、`/dev/debug` と `/api/dev/debug` が404
- 既存JR東日本版が無変更
- 公開URLでスマートフォン、PWAアイコン、Push未設定時のSW登録を確認
- 品川〜泉岳寺対象外・Challenge限定・問い合わせ先・クレジットを公開画面に表示

### ODPTライブ有効化

- ライセンス不整合をODPTへ確認し、回答記録を保存
- 非公開環境で実Challenge API疎通と `/dev/debug` の確認を完了
- 京急版専用のODPTトークン保管先、KV、VAPID鍵を用意
- Productionで `ODPT_LIVE_DATA_APPROVED=true` にする新しいdeploymentを作成
- 実データ提供範囲、品川〜泉岳寺対象外、期限停止を公開URLで再確認
