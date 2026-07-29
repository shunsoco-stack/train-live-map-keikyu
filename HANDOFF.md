# HANDOFF — Train Live Map 京急線版（非公式）

更新日: 2026-07-30

## 絶対に守る分離

- 新規GitHubリポジトリ: `train-live-map-keikyu`
- 新規Vercelプロジェクト: 既存JR東日本版とリンクしない
- 京急版専用KV: 既存版のURL・トークン・データベースを再利用しない
- 京急版専用VAPID鍵ペア: 公開鍵／秘密鍵とも新規生成
- `.env.local`、Vercel Environment Variables以外へ秘密値を保存しない
- 既存 `train-live-map` リポジトリへcommit・pushしない

このディレクトリは `main` ブランチの独立したGitリポジトリとして初期化済みです。remoteを設定する場合は、現在地が `train-live-map-keikyu` であることと、remote先が新規リポジトリであることを再確認してください。

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

## 外部作業

1. GitHubで空の `train-live-map-keikyu` を作成する。
2. このディレクトリだけを初期化して、新規remoteを設定する。
3. Vercelで既存プロジェクトの複製ではなく、新規プロジェクトを作成する。
4. 京急版専用KVを新規作成する。
5. `web-push generate-vapid-keys` で京急版専用鍵を生成する。
6. Vercel Production / Previewへ指定された9変数を設定する。加えて `ODPT_LIVE_DATA_APPROVED=false` を設定し、特定利用条件の確認記録が完了した後だけ `true` へ変更する。手動バナー広告を使う場合だけ、任意の `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` も設定する。
7. Previewで疎通後、Productionへ同じ変数名を設定する。値の表示・スクリーンショット・ログ保存は避ける。
8. `/dev/debug` でChallenge APIの実データを確認する。
9. 公開URLを320/375/393/430pxとiPhoneホーム画面追加で確認する。

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

指定された正式な変数名は `NEXT_PUBLIC_ADSENSE_CLIENT_ID` です。手動バナー広告ユニットにはGoogleが発行するslot IDも必要なため、任意の `NEXT_PUBLIC_ADSENSE_BANNER_SLOT` を使います。値がなければ架空のslotを補わず、プレースホルダー表示に留めます。旧 `NEXT_PUBLIC_ADSENSE_CLIENT` は使用しません。詳細は `ADSENSE_SETUP.md` を参照してください。

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

- `npm run lint`: 成功
- `npm test`: 98 / 98成功
- `npm run build`: 成功（Next.js 16.2.12）
- 本番サーバーの `/`: HTTP 200
- 本番サーバーの `/api/trains`: 承認ゲート未解除時は `source=mock`、特定利用条件の確認待ちnotice
- 本番サーバーの `/dev/debug` / `/api/dev/debug`: HTTP 404
- 320 / 375 / 393 / 430px: document・地図・canvas幅がviewport幅と一致し、横はみ出しなし
- 4幅すべて「Train Live Map」「京急線版（非公式）」が省略なし
- ブラウザー操作: 路線検索、お気に入り登録／絞り込み、空港線だけへの切替、表示路線だけの運行情報を確認
- manifest、192 / 512 / maskable / Appleアイコン、Service Worker: HTTP 200
- ブラウザーconsole: error / warningなし
- 実API疎通、GitHub push、Vercel、公開URL実機確認は未完了

## 完了判定

- lint / test / build成功
- 実Challenge API疎通
- 新規GitHubリポジトリへpush
- 新規Vercelプロジェクトへdeploy
- Production / Previewの環境変数設定
- 既存JR東日本版が無変更
- 公開URLでスマートフォン、PWAアイコン、Push未設定時のSW登録を確認
- ライセンス不整合をODPTへ確認済み
- 品川〜泉岳寺対象外・Challenge限定・問い合わせ先・クレジットを公開画面に表示
