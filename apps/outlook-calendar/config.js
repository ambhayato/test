/**
 * Outlook Calendar Viewer — Azure AD Configuration
 *
 * 【設定方法】
 * 以下の 2 つの値を入力して保存してください。
 * 入力しない場合は、アプリ起動時に画面から設定できます。
 *
 * 【Azure AD アプリ登録手順】
 * 1. https://portal.azure.com → 「Microsoft Entra ID」→「アプリの登録」
 * 2. 「新規登録」
 *    - 名前: 任意 (例: Outlook予定表ビューア)
 *    - サポートされているアカウントの種類: 「この組織ディレクトリのみのアカウント」
 *    - リダイレクト URI: 「シングルページアプリケーション (SPA)」を選択し、
 *      このアプリを開く URL を入力 (例: http://localhost:3000/index.html)
 * 3. 「API のアクセス許可」→「アクセス許可の追加」→「Microsoft Graph」→「委任されたアクセス許可」
 *    以下を追加:
 *    - User.ReadBasic.All  (組織のユーザー一覧を取得)
 *    - Calendars.Read      (自分と他者の予定表を参照)
 * 4. 必要に応じて「管理者の同意を付与」をクリック
 * 5. 「概要」画面から以下をコピー:
 *    - アプリケーション (クライアント) ID → CLIENT_ID
 *    - ディレクトリ (テナント) ID        → TENANT_ID
 */

window.OUTLOOK_CALENDAR_CONFIG = {
  clientId: '',   // 例: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  tenantId: '',   // 例: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
};
