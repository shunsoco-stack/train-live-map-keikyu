# Google AdSense設定

京急版は既存JR東日本版と別のVercelプロジェクトとして設定します。

## 環境変数

サイト共通のAdSenseコードと `ads.txt` に使う正式な変数名は次の1つです。

```text
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
```

固定のバナー広告ユニットへ実広告を出す場合だけ、AdSense管理画面で作成した広告ユニットのslot IDも設定します。

```text
NEXT_PUBLIC_ADSENSE_BANNER_SLOT=1234567890
```

slot IDはクライアントIDから導出できません。未設定時は架空の値を補わず、バナー位置には安全なプレースホルダーを表示します。クライアントIDだけを設定した場合、サイト共通コードはAuto ads用として読み込まれます。

クライアントIDはブラウザーへ公開される値ですが、入力ミスや別サイトとの混同を避けるため、VercelのEnvironment Variablesから設定します。

- Production: サイト審査・所有権確認後に設定
- Preview: 通常は未設定を推奨。設定する場合もPreviewへ明示的に追加
- Development: 広告表示の確認が必要な場合だけ `.env.local` に設定

クライアントIDが未設定または `ca-pub-` 形式でない場合、広告スクリプトと`/ads.txt`を安全に無効化します。slot IDが未設定または数字以外の場合、手動バナーへ実広告を要求しません。

## ads.txt

`/ads.txt` は設定済みクライアントIDからpublisher IDを組み立てます。

```text
google.com, pub-xxxxxxxxxxxxxxxx, DIRECT, f08c47fec0942fa0
```

公開後に次を確認します。

1. `https://<京急版ドメイン>/ads.txt` が200で返る
2. publisher IDが京急版へ設定したAdSenseアカウントと一致する
3. 未設定のPreviewでは404になり、ダミーIDが出ない
4. ページソースへクライアントID以外の認証情報が出ていない

## 実装上の注意

- 旧変数名 `NEXT_PUBLIC_ADSENSE_CLIENT` は使用しない
- 広告slot IDを架空に設定せず、AdSense管理画面で発行された実在値だけを使う
- AdSense審査前は空の広告領域で操作ボタンを覆わない
- 320px幅とsafe-areaでレイアウトを確認する
- Challenge限定データの利用条件と広告掲載が両立するか、Production公開前にODPTへ確認する
