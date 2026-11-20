import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー｜Train Live Map 京急線版",
  description: "Train Live Map 京急線版の広告配信と、このアプリが扱う情報について。",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 leading-8 text-rail-text">
      <p className="text-xs font-bold tracking-[0.14em] text-rail-muted">PRIVACY</p>
      <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">プライバシーポリシー</h1>
      <p className="mt-2 text-sm text-rail-muted">最終更新日: 2026年11月20日</p>
      <section className="mt-8">
        <h2 className="text-lg font-bold">広告配信（忍者AdMax）とオプトアウト</h2>
        <p className="mt-3">
          本番環境のトップページ（地図パネル末尾）では、忍者ツールズ株式会社が提供する広告配信サービス「忍者AdMax」を利用しています。忍者AdMaxおよびその提携事業者は、広告の配信、効果測定、不正防止などのため、Cookie等の技術を利用して、アクセス日時、閲覧したページのURL、リファラー、IPアドレス、ブラウザ・端末に関する情報などを取得する場合があります。取得された情報は、各事業者のプライバシーポリシー等に従って取り扱われます。
        </p>
        <p className="mt-3">
          Cookie等による情報の取得を望まない場合は、ブラウザの設定でCookieを無効にする、または削除することで拒否（オプトアウト）できます。ただし、一部の機能が正常に利用できなくなる場合があります。オプトアウトの方法と提携事業者については、忍者ツールズの
          <a href="https://corp.ninja.co.jp/privacy/cookie/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">「Cookie等の技術や広告用IDの利用について」</a>
          を、個人情報の取扱いについては
          <a href="https://corp.ninja.co.jp/privacy/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">忍者ツールズのプライバシーポリシー</a>
          をご確認ください。
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-bold">このアプリが扱う情報</h2>
        <p className="mt-3">
          表示設定などは端末内に保存します。広告のために、保存済みの路線選択などのアプリデータを送信する処理はありません。本アプリは京急電鉄の公式サービスではありません。
        </p>
      </section>
      <p className="mt-10">
        <Link href="/" className="font-bold underline underline-offset-4">トップへ戻る</Link>
      </p>
    </main>
  );
}
