import { useNavigate } from "react-router";
import { Icon } from "~/components/Icon";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-200 mb-3">
        第{number}条 {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-dark text-gray-200">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md px-4 pt-6 pb-4 border-b border-white/10 bg-bg-dark/80">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white/10"
            aria-label="戻る"
          >
            <Icon name="arrow_back" className="text-xl text-gray-300" />
          </button>
          <h1 className="text-lg font-bold text-center">
            プライバシーポリシー
          </h1>
          <div className="size-10" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-5 py-8 space-y-8 text-sm leading-relaxed">
        <p className="text-gray-400 text-xs">最終更新日: 2026年2月28日</p>

        <p>
          Roamble（以下「本サービス」）は、運営者が提供するWebアプリケーションです。
          運営者は、本サービスをご利用いただくにあたり、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定め、
          個人情報の適切な保護に努めます。
        </p>

        {/* 1. 取得する情報 */}
        <Section number={1} title="取得する情報">
          <p>本サービスでは、以下の情報を取得します。</p>

          <SubSection title="(1) Google アカウント情報（Google OAuth 経由）">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>メールアドレス</li>
              <li>表示名</li>
              <li>プロフィール画像URL</li>
            </ul>
            <p className="mt-2 text-gray-400">
              本サービスはGoogleの認証機能（OAuth
              2.0）を利用してログインを行います。
              Googleアカウントのパスワードは本サービスには送信・保存されません。
            </p>
          </SubSection>

          <SubSection title="(2) 位置情報">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                ブラウザの位置情報API（Geolocation
                API）を通じて取得する現在地の緯度・経度
              </li>
            </ul>
            <p className="mt-2 text-gray-400">
              現在地の緯度・経度は、周辺施設の提案を行うためにのみ使用し、
              <strong className="text-gray-300">
                サーバーには保存しません
              </strong>
              。 提案処理の完了後、サーバー上から即座に破棄されます。
            </p>
          </SubSection>

          <SubSection title="(3) 訪問記録に関する情報">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>訪問した施設のGoogle Place ID・施設名・カテゴリ・所在地</li>
              <li>訪問した施設の緯度・経度（地図表示用）</li>
              <li>訪問日時</li>
              <li>ユーザーが入力した評価・メモ</li>
            </ul>
          </SubSection>

          <SubSection title="(4) サービス利用に関する情報">
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>興味ジャンル（ユーザーが選択した施設ジャンル）</li>
              <li>
                ゲーミフィケーションデータ（XP、レベル、獲得バッジ、ジャンル習熟度）
              </li>
              <li>提案半径の設定値</li>
            </ul>
          </SubSection>

          <SubSection title="(5) アクセス解析情報（導入予定）">
            <p>
              本サービスでは、サービス改善を目的として、Google
              Analytics（GA4）の導入を予定しています。
              導入後は、以下の情報が自動的に収集されます。
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
              <li>アクセス元のIPアドレス（匿名化処理済み）</li>
              <li>ブラウザの種類・画面サイズ</li>
              <li>ページ閲覧履歴・滞在時間</li>
              <li>
                カスタムイベント（提案生成、訪問記録、バッジ獲得などの操作）
              </li>
            </ul>
            <p className="mt-2 text-gray-400">
              これらの情報はGoogleのサーバーに送信されます。 詳細は
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Google プライバシーポリシー
              </a>
              をご参照ください。
            </p>
          </SubSection>
        </Section>

        {/* 2. 利用目的 */}
        <Section number={2} title="利用目的">
          <p>取得した情報は、以下の目的で利用します。</p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>ユーザー認証・アカウント管理</li>
            <li>ユーザーの現在地に基づく周辺施設の提案</li>
            <li>興味ジャンルに基づくパーソナライズされた施設提案</li>
            <li>訪問履歴の記録・表示（地図表示を含む）</li>
            <li>
              ゲーミフィケーション機能の提供（XP付与・レベル管理・バッジ付与）
            </li>
            <li>サービスの改善・分析</li>
            <li>お問い合わせへの対応</li>
          </ul>
        </Section>

        {/* 3. Google ユーザーデータの取扱い */}
        <Section number={3} title="Google ユーザーデータの取扱い">
          <p>
            本サービスは、
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google API Services User Data Policy
            </a>
            （Limited Use requirements を含む）に準拠しています。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-3">
            <li>
              Google
              から取得するデータは、メールアドレス・表示名・プロフィール画像URL
              に限定されます
            </li>
            <li>
              これらのデータは、本サービスのアカウント認証・プロフィール表示のためにのみ使用します
            </li>
            <li>Google ユーザーデータを広告目的で使用することはありません</li>
            <li>
              Google ユーザーデータを第三者に販売・提供することはありません
            </li>
            <li>
              Google
              ユーザーデータへのアクセスは、サービス提供に必要な最小限の範囲に限定しています
            </li>
          </ul>
        </Section>

        {/* 4. Cookie・ローカルストレージの利用 */}
        <Section number={4} title="Cookie・ローカルストレージの利用">
          <p>
            本サービスでは、以下の目的でブラウザのローカルストレージを使用します。
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 pr-4 font-semibold">保存データ</th>
                  <th className="py-2 pr-4 font-semibold">目的</th>
                  <th className="py-2 font-semibold">必須/任意</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">JWT認証トークン</td>
                  <td className="py-2 pr-4">ログイン状態の維持</td>
                  <td className="py-2">必須</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">オンボーディング完了フラグ</td>
                  <td className="py-2 pr-4">初回設定の管理</td>
                  <td className="py-2">必須</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-gray-400">
            Google
            Analytics（GA4）導入後は、Googleが設定するCookieも使用されます。
            ブラウザの設定でCookieを無効にすることが可能ですが、本サービスの一部機能が利用できなくなる場合があります。
          </p>
        </Section>

        {/* 5. 第三者提供 */}
        <Section number={5} title="第三者への提供">
          <p>
            運営者は、以下の場合を除き、ユーザーの個人情報を第三者に提供することはありません。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>ユーザー本人の同意がある場合</li>
            <li>法令に基づく場合</li>
            <li>
              人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難である場合
            </li>
          </ul>
          <p className="mt-3 text-gray-400">
            ただし、本サービスの提供にあたり、以下の外部サービスを利用しており、
            各サービスのプライバシーポリシーに従って情報が処理される場合があります。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>
              <strong>Google（OAuth認証・Places API・Analytics）</strong> —{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                プライバシーポリシー
              </a>
            </li>
          </ul>
        </Section>

        {/* 6. 外国への個人データ移転 */}
        <Section number={6} title="個人データの保存先">
          <p>
            本サービスでは、サービス提供に必要なインフラストラクチャとして、
            以下の外国に所在するクラウドサービスを利用しています。
            個人情報保護法第28条に基づき、以下のとおり情報提供します。
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 pr-4 font-semibold">サービス</th>
                  <th className="py-2 pr-4 font-semibold">用途</th>
                  <th className="py-2 font-semibold">所在国</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">Render</td>
                  <td className="py-2 pr-4">バックエンドサーバー</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">TiDB Cloud</td>
                  <td className="py-2 pr-4">データベース</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">Upstash</td>
                  <td className="py-2 pr-4">キャッシュ（Redis）</td>
                  <td className="py-2">米国</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">Cloudflare</td>
                  <td className="py-2 pr-4">フロントエンド配信</td>
                  <td className="py-2">米国（CDNは世界各地）</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-gray-400">
            米国には、個人情報の保護に関する包括的な連邦法は存在しませんが、
            各サービスの利用規約およびセキュリティ対策に基づき、適切な保護措置が講じられています。
          </p>
        </Section>

        {/* 7. 安全管理措置 */}
        <Section number={7} title="安全管理措置">
          <p>
            運営者は、個人データの漏洩・滅失・毀損を防止するため、以下の措置を講じています。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>通信の暗号化（HTTPS/TLS）</li>
            <li>
              認証トークン（JWT）の有効期限管理・リフレッシュトークンによるセッション管理
            </li>
            <li>
              パスワードの非保存（Google
              OAuth認証のため、パスワードはサービス上に存在しません）
            </li>
            <li>
              アクセス制御（データベースへのアクセスは認証済みAPIを通じた間接アクセスに限定）
            </li>
            <li>レート制限による不正アクセスの防止</li>
          </ul>
        </Section>

        {/* 8. データの保存期間 */}
        <Section number={8} title="データの保存期間">
          <p>
            ユーザーのアカウント情報および関連データは、アカウントが存在する間保持されます。
          </p>
          <p className="mt-2">
            アカウントを削除した場合、以下のデータはすべて即座にデータベースから完全に削除されます。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>ユーザー情報（メールアドレス・表示名・プロフィール画像URL）</li>
            <li>訪問記録（施設情報・評価・メモを含む）</li>
            <li>
              ゲーミフィケーションデータ（XP・レベル・バッジ・ジャンル習熟度）
            </li>
            <li>興味ジャンルの設定</li>
          </ul>
        </Section>

        {/* 9. ユーザーの権利 */}
        <Section number={9} title="ユーザーの権利">
          <p>
            ユーザーは、個人情報保護法に基づき、以下の権利を行使することができます。
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
            <li>
              <strong>開示請求</strong> — ご自身の個人情報の開示を請求できます
            </li>
            <li>
              <strong>訂正・追加・削除</strong> —
              個人情報の内容が事実でない場合、訂正等を請求できます
            </li>
            <li>
              <strong>利用停止・消去</strong> —
              個人情報の利用停止・消去を請求できます
            </li>
            <li>
              <strong>アカウント削除</strong> —
              設定画面からいつでもアカウントを削除できます。削除により全データが完全に消去されます
            </li>
          </ul>
          <p className="mt-2 text-gray-400">
            上記権利の行使をご希望の場合は、末尾のお問い合わせ先までご連絡ください。
          </p>
        </Section>

        {/* 10. 未成年の利用 */}
        <Section number={10} title="未成年の利用について">
          <p>
            本サービスは、13歳未満のお子様を対象としておらず、
            13歳未満のお子様から意図的に個人情報を収集することはありません。
            13歳未満のお子様が本サービスを利用されていることが判明した場合、
            当該アカウントのデータを速やかに削除します。
          </p>
        </Section>

        {/* 11. プライバシーポリシーの変更 */}
        <Section number={11} title="プライバシーポリシーの変更">
          <p>
            運営者は、必要に応じて本ポリシーを変更することがあります。
            重要な変更を行う場合は、本サービス上での通知等の適切な方法でお知らせします。
            変更後のプライバシーポリシーは、本ページに掲載したときから効力を生じます。
          </p>
        </Section>

        {/* 12. お問い合わせ */}
        <Section number={12} title="お問い合わせ">
          <p>
            本ポリシーに関するお問い合わせは、以下の連絡先までお願いいたします。
          </p>
          <div className="mt-3 p-4 bg-white/5 rounded-4xl border border-white/10">
            <p className="font-semibold">Roamble 運営者</p>
            <p className="mt-1">
              メール:{" "}
              <a
                href="mailto:official@roamble.app"
                className="text-primary underline"
              >
                official@roamble.app
              </a>
            </p>
          </div>
        </Section>

        <p className="text-center text-xs text-gray-500 pt-4 pb-8 border-t border-white/10">
          制定日: 2026年2月28日
        </p>
      </main>
    </div>
  );
}
