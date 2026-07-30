# Train Live Map — 京急線版（非公式）

京急線内の列車位置と運行情報を地図で確認する、スマートフォン向けの非公式Webアプリです。

> 公共交通データの出典は、公共交通オープンデータセンターです。京急電鉄が提供するデータに基づきますが、データの正確性・完全性は保証されません。本アプリは京急電鉄の公式サービスではありません。本アプリの内容について、京急電鉄へ直接問い合わせないでください。

列車に緯度経度が含まれない場合、`fromStation`、`toStation`、駅順、路線形状から線路上の位置を推定します。画面では「ODPTライブ／位置は駅間推定」と明記し、実測位置として扱いません。

## 対象

- 京急本線
- 空港線
- 大師線
- 逗子線
- 久里浜線

直通列車も、ODPTから取得できる京急線内の範囲だけを表示します。都営浅草線・京成線などの取得できない位置を推測で延長しません。

京急電鉄の列車ロケーションデータでは、**品川〜泉岳寺間が対象外**です。この区間には列車を表示せず、モックや推測でも補完しません。

## デザイン

M PLUS Rounded 1cと表情付きの赤い電車を軸に、地図を主役にしたモバイルUIです。

- 背景や操作面は暖色系の白と中立色を使い、京急らしい赤は列車・選択・主要操作へ限定
- ヘッダーは正式名称と「京急線版（非公式）」の2段を維持し、データ元と更新時刻を短く表示
- 表示中の路線に関係する運行情報だけを、重大度順で最重要1件から表示
- 列車フィルター、みんなの情報、路線選択を一つのフローティングドックへ集約
- 路線選択、投稿、列車詳細、データ利用案内は共通のネイティブ`dialog`を使い、フォーカス移動・復帰を統一
- すべての主要操作を44px以上にし、`safe-area`、`prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast`へ対応
- AdSense未設定時は空の広告枠を表示せず、地図へ領域を返す

画面幅320px、375px、393px、430pxでページ全体の横スクロールが発生しないことを確認しています。列車フィルターだけは、優先度の高い「すべて／遅延／運転見合わせ」から横スクロールできます。

## 開発

```bash
npm install
cp .env.example .env.local
npm run dev
```

Challenge 2026のアクセストークンは、対話入力で保存することもできます。

```bash
bash scripts/set-odpt-token.sh
```

このスクリプトはトークンを画面へ表示せず、引数でも受け取りません。設定後、`/dev/debug` で次を実データから確認してください。

- 京急のoperator ID
- 5路線の路線ID、駅順、路線形状
- `odpt:Train` と `odpt:TrainInformation` の取得可否
- 上下方向、列車種別、行先、遅延時間

路線IDは確認結果から決め、名称だけで推測して固定しないでください。

## アーキテクチャ上の境界

UIは具体的なデータプロバイダを参照せず、`trainLocationService` を通して切り替えます。

- `KeikyuTrainLocationProvider`: Challenge 2026の京急データ
- `MockTrainLocationProvider`: API失敗時と開発用。対象外区間を補完しない

みんなの情報と公式情報は別の出典です。

- 公式情報: ODPTの `odpt:TrainInformation` など
- みんなの情報: 利用者による平常・遅延・見合わせ投稿

利用者投稿は必ず「みんなの情報」「利用者投稿」と表示します。見合わせ投稿の急増通知も公式発表ではありません。列車単位の遅延時間が取得できない場合、架空の「+○分」を作りません。

## 環境変数

| 変数 | 公開範囲 | 用途 |
| --- | --- | --- |
| `ODPT_ACCESS_TOKEN` | 秘密 | Challenge 2026 APIトークン |
| `ODPT_API_BASE_URL` | サーバー | `https://api-challenge.odpt.org/api/v4` |
| `ODPT_LIVE_DATA_APPROVED` | サーバー | 特定利用条件の確認記録が完了するまで`false`。完了後だけ`true` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 公開 | ブラウザー用VAPID公開鍵 |
| `VAPID_PUBLIC_KEY` | サーバー | 同じVAPID公開鍵 |
| `VAPID_PRIVATE_KEY` | 秘密 | VAPID秘密鍵 |
| `VAPID_SUBJECT` | サーバー | `mailto:` または `https://` の運営者連絡先 |
| `KV_REST_API_URL` | 秘密扱い | 京急版専用KV REST URL |
| `KV_REST_API_TOKEN` | 秘密 | 京急版専用KVトークン |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | 公開 | `ca-pub-...` 形式のAdSense ID |
| `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` | 公開・任意 | 手動バナー広告ユニットのslot ID。未設定なら架空値や空の広告枠を表示しない |

本番の主経路は、新規Vercelプロジェクト `train-live-map-keikyu` です。既存JR東日本版のVercelプロジェクト `train-live-map` やGitHubリポジトリへ接続しません。環境変数は京急版プロジェクトのProject Settingsだけへ保存し、ProductionとPreviewへ個別に設定します。Team Shared Environment Variablesや既存版の値は再利用しません。`NEXT_PUBLIC_*` はビルド時に公開バンドルへ埋め込まれるため、変更後は新しいdeploymentを作成します。

最初のProduction／Preview公開は、次の非秘密値だけを使う **mock-only** 構成です。

- `ODPT_API_BASE_URL=https://api-challenge.odpt.org/api/v4`
- `ODPT_LIVE_DATA_APPROVED=false`

この状態では `ODPT_ACCESS_TOKEN`、KV、VAPID、`NEXT_PUBLIC_ADSENSE_CLIENT_ID`、`NEXT_PUBLIC_ADSENSE_BANNER_SLOT` を設定しません。ODPTライブ取得は開始せず、列車データはモックへフォールバックします。KV依存機能、Push通知、AdSense広告は安全に無効化し、広告用の空き領域も確保しません。PWAのService Worker登録は継続します。特定利用条件の確認記録と実API疎通が完了するまで、`ODPT_LIVE_DATA_APPROVED` を `true` へ変更してはいけません。

次の値とリソースを既存JR東日本版と共有してはいけません。

- GitHubリポジトリ
- Vercelプロジェクト、Git連携、deployment履歴、ドメイン
- VercelのProject Environment Variables
- Firebaseを代替経路として使う場合のFirebaseプロジェクト、App Hostingバックエンド、Firebase Web App、Cloud Secret Managerのsecret
- KVデータベース／トークン
- VAPID鍵ペア
- ODPTトークンの保管先

VAPID未設定時はPush通知だけが無効になります。PWAのService Worker登録は継続します。
初回のmock-only公開ではAdSenseを無効のままにします。将来有効化する場合、クライアントIDだけを設定するとサイト共通コードと`ads.txt`だけが有効になります。固定バナーへ実広告を出す場合だけ、AdSense管理画面で作成した実在のslot IDも設定します。

### 保存領域のnamespace

すべて `train-live-map-keikyu` で分離します。

- KV: `train-live-map-keikyu:community:reports:v1`
- KV: `train-live-map-keikyu:community:push-subscriptions:v1`
- localStorage: `train-live-map-keikyu:community:reporter:v1`
- localStorage: `train-live-map-keikyu:community:push-lines:v1`
- localStorage: `train-live-map-keikyu:visible-lines`
- localStorage: `train-live-map-keikyu:favorite-lines`
- 投稿者hash、Push購読hash、通知tag／topicも同じnamespaceを含む

## PWAと画像資産

`public/icons/train-live-map-keikyu.svg` が原本です。公式ロゴや公式車両画像は使用せず、笑顔のオリジナル赤い電車として制作しています。アイコン内には「Train Live Map」「京急線版」「非公式」を表示します。

```bash
node scripts/generate-keikyu-icons.mjs
```

生成物:

- `public/icons/train-live-map-keikyu-192.png`
- `public/icons/train-live-map-keikyu-512.png`
- `public/icons/train-live-map-keikyu-maskable-512.png`
- `public/apple-touch-icon.png`
- `public/og-train-live-map-keikyu.png`
- `public/og.png`

## Challenge 2026ライセンスと公開前確認

2026年7月29日時点に確認した公式ページを基準にしています。公開前と公開中も更新を再確認してください。

- [公共交通オープンデータチャレンジ2026](https://challenge2026.odpt.org/): コンテスト実施期間は2026年7月1日〜2027年3月12日
- [京急電鉄 列車ロケーション情報](https://ckan.odpt.org/dataset/keikyu__r_train_location): Challenge 2026限定、品川〜泉岳寺間は対象外
- [公共交通オープンデータチャレンジ限定ライセンス](https://developer.odpt.org/challenge_license): 利用許諾は2027年3月14日に終了し、終了時は利用停止と限定データの削除が必要
- [公共交通オープンデータ開発者ガイドライン](https://developer.odpt.org/terms/data_basic_use_guideline.html): 更新時刻、最新情報、出典、非保証、アプリ問い合わせ先の表示が必要

限定データはChallenge応募目的で使用し、Challenge期間中は誰でも無料で利用できる機能を提供します。元データまたは大部分を復元できる派生データを、第三者が再利用できる形で公開・再配布しません。

サーバーは `ODPT_LIVE_DATA_APPROVED=true` が明示されない限り、トークンがあってもODPTを呼びません。また、日本時間2027年3月15日00:00以降は、トークンと承認設定が残っていてもODPTライブ取得を拒否してモックへ切り替えます。保存済み限定データの削除と外部運用停止は、別途期限前の運用タスクでも管理してください。

### ライセンス表示の不整合（公開ブロッカー）

京急の列車ロケーションデータセットは「限定ライセンスおよびその特定利用条件」を読むよう案内しています。一方、2026年7月29日に確認した限定ライセンスページの「特定利用条件」には、京急電鉄向けの条項を確認できませんでした。

これは「京急には追加条件がない」と解釈してはいけません。**ProductionでODPT実データを有効化する前に、ODPT事務局へ京急データの特定利用条件の所在と適用内容を確認し、その回答を保存してください。** 解消するまで実データ公開を完了扱いにしません。

## 問い合わせ

アプリの表示・動作に関する問い合わせは、本リポジトリのIssuesで受け付けます。京急電鉄へ直接問い合わせないでください。データ利用条件については、まずODPTの開発者ドキュメントを確認し、必要な場合だけODPT事務局へ確認します。

## 検証

```bash
npm run lint
npm test
npm run build
```

## Vercelへの公開

本アプリはNext.jsの標準構成で、VercelではFramework Presetの自動検出と `npm run build` を使用します。`vercel.json` は不要です。新規Vercelプロジェクト `train-live-map-keikyu` を作成し、新規GitHubリポジトリ `shunsoco-stack/train-live-map-keikyu` だけを接続してください。既存の `train-live-map` プロジェクト、Git連携、環境変数、ドメインを流用しません。

- Runtime: Node.js 22.x（`package.json` とGitHub Actionsを統一）
- Environment Variables: Project SettingsでProductionとPreviewへ個別設定
- 初回公開: `ODPT_API_BASE_URL` と `ODPT_LIVE_DATA_APPROVED=false` だけ
- ODPTトークン、KV、VAPID、AdSense: 初回公開では未設定
- AdSense: `NEXT_PUBLIC_ADSENSE_CLIENT_ID` と `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` を空欄にして無効化

2026年7月30日時点で、Vercel GitHub Appによる自動連携はGitHub側のsudo再認証待ちです。再認証が完了するまで自動deployを有効化せず、回避策として既存JR東日本版のリポジトリやVercelプロジェクトへ接続しないでください。再認証後は新規リポジトリだけをimportし、Project NameとGit Repositoryがどちらも `train-live-map-keikyu` であることを確認してからdeployします。

### Firebase App Hosting（代替経路）

`firebase.json`、`.firebaserc`、`apphosting.yaml` はFirebase App Hostingを使う場合の代替設定として残しています。Vercel公開の主経路では使用せず、Firebaseへのdeployは未完了です。代替経路を採用する場合も既存JR東日本版と分離したFirebaseプロジェクトだけを使い、秘密値はCloud Secret Managerへ保存して `apphosting.yaml` に直書きしません。

- Backend ID: `train-live-map-keikyu`
- Region: `asia-east1`
- Runtime: バージョン固定のNode.js runtime（ABIU有効）
- Cloud Run: `minInstances: 0`、`maxInstances: 2`
- Source deploy: `firebase.json` と `apphosting.yaml`

App HostingにはBlaze従量課金プランが必要です。無料枠を超えた利用は課金され、予算アラートは支出上限ではありません。請求先の接続と予算アラートは、Firebase Consoleで明示的に確認してから行います。

```bash
firebase deploy --only apphosting:train-live-map-keikyu
```

Firebase App Hostingが公式にactive supportとして列挙しているNext.jsは現在15.2系までで、本アプリのNext.js 16.2.12はpreview扱いです。App Hostingのビルドで互換性エラーが出た場合だけ、ログを確認して公式active版への変更を判断します。

加えて、320px、375px、393px、430pxで表示を確認し、公開URLをホーム画面へ追加してアイコン、safe-area、Service Worker、`prefers-reduced-motion` を実機確認します。

2026年7月30日のローカル確認では、lint、103件のテスト、本番buildが成功しました。320 / 375 / 393 / 430pxではdocument・地図・canvas幅がviewport幅と一致し、2段ヘッダーも省略されません。路線検索、お気に入り、表示路線の切替、表示路線だけの運行情報、PWA資産のHTTP 200も確認済みです。Vercelプロジェクト作成、自動連携、公開URL、ホーム画面追加の実機確認は未完了です。実Challenge API疎通は、特定利用条件を確認した非公開の検証環境で行います。

## セキュリティ

- `.env*` は `.env.example` を除いてGit対象外です。
- トークン、秘密鍵、KVトークン、Push購読endpointをログへ出しません。
- 利用者投稿の接続元IPは保存・ログ出力せず、サーバー秘密値を鍵にしたHMAC識別子だけをレート制限と30分集計へ使用します。
- 秘密値をCLI引数へ渡しません。
- 誤ってコミットした場合は、履歴削除だけで済ませず直ちに失効・再発行します。
