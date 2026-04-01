/**
 * content.js
 * マニュアルの全コンテンツデータ。
 *
 * 各エントリの構造:
 *   id       {string}       URL クエリパラメータ (?page=xxx) に使用するスラッグ
 *   title    {string}       ページタイトル（TOC・ページ見出しに表示）
 *   section  {string|null}  親セクションの id（null = セクション自体）
 *   order    {number}       同一セクション内での表示順
 *   content  {string}       本文 HTML（h2〜, p, pre, table, blockquote など）
 *
 * 新しいページを追加するには、このファイルに配列要素を追加するだけです。
 */

const MANUAL_CONTENT = [

  /* ==============================================================
     セクション: はじめに
     ============================================================== */
  {
    id: 'intro-overview',
    title: '概要',
    section: 'intro',
    sectionLabel: 'はじめに',
    order: 1,
    content: `
<h1>概要</h1>
<p>このマニュアルは、Azure 上で動作する IIS（Internet Information Services）Web サーバーの
セットアップ・設定・運用手順をまとめたものです。</p>

<h2>このマニュアルの対象読者</h2>
<ul>
  <li>Azure 上に Web アプリケーションをデプロイしたいシステム管理者</li>
  <li>IIS の設定や管理を担当する Web 担当者</li>
  <li>Azure App Service や仮想マシン上に IIS を構築するエンジニア</li>
</ul>

<h2>前提知識</h2>
<ul>
  <li>Windows Server の基本操作</li>
  <li>Azure ポータルの基本操作</li>
  <li>HTTP/HTTPS の基本概念</li>
</ul>

<blockquote>
  <p><strong>Note:</strong> このマニュアルは枠組みサンプルです。各セクションに実際の手順を追記してください。</p>
</blockquote>
`
  },
  {
    id: 'intro-architecture',
    title: 'アーキテクチャ概要',
    section: 'intro',
    sectionLabel: 'はじめに',
    order: 2,
    content: `
<h1>アーキテクチャ概要</h1>
<p>Azure + IIS 構成のアーキテクチャ概要を説明します。</p>

<h2>構成図</h2>
<pre><code>[ クライアントブラウザ ]
        │ HTTPS
        ▼
[ Azure Application Gateway / Front Door ]  ← SSL 終端・ロードバランサー
        │ HTTP / HTTPS
        ▼
[ Azure VM / App Service (Windows) ]
  └── IIS 10.0
        ├── Site: www.example.com  → C:\\inetpub\\wwwroot\\myapp
        └── Site: api.example.com  → C:\\inetpub\\wwwroot\\api
</code></pre>

<h2>主要コンポーネント</h2>
<table>
  <thead>
    <tr><th>コンポーネント</th><th>役割</th></tr>
  </thead>
  <tbody>
    <tr><td>Azure Application Gateway</td><td>SSL 終端、ロードバランシング、WAF</td></tr>
    <tr><td>Windows Server (IIS)</td><td>Web アプリケーションのホスティング</td></tr>
    <tr><td>Azure SQL Database</td><td>アプリケーションデータの永続化</td></tr>
    <tr><td>Azure Blob Storage</td><td>静的ファイル・メディアコンテンツの格納</td></tr>
  </tbody>
</table>
`
  },

  /* ==============================================================
     セクション: インストール・セットアップ
     ============================================================== */
  {
    id: 'setup-prerequisites',
    title: '前提条件',
    section: 'setup',
    sectionLabel: 'インストール・セットアップ',
    order: 1,
    content: `
<h1>前提条件</h1>
<p>IIS をセットアップする前に、以下の要件を満たしていることを確認してください。</p>

<h2>システム要件</h2>
<ul>
  <li>Windows Server 2019 / 2022 または Azure App Service (Windows)</li>
  <li>4 GB 以上のメモリ（推奨: 8 GB 以上）</li>
  <li>30 GB 以上の空きディスク容量</li>
  <li>インターネット接続（Azure ポータルへのアクセス）</li>
</ul>

<h2>必要な権限</h2>
<ul>
  <li>Azure サブスクリプションの所有者または共同作成者ロール</li>
  <li>Windows Server のローカル管理者権限</li>
</ul>
`
  },
  {
    id: 'setup-iis-install',
    title: 'IIS のインストール',
    section: 'setup',
    sectionLabel: 'インストール・セットアップ',
    order: 2,
    content: `
<h1>IIS のインストール</h1>
<p>Windows Server に IIS をインストールする手順を説明します。</p>

<h2>サーバーマネージャーを使用する方法</h2>
<ol>
  <li>サーバーマネージャーを開く</li>
  <li>[役割と機能の追加] をクリック</li>
  <li>[役割ベースまたは機能ベースのインストール] を選択</li>
  <li>[Web サーバー (IIS)] にチェックを入れる</li>
  <li>必要な役割サービスを選択してインストール</li>
</ol>

<h2>PowerShell を使用する方法</h2>
<pre><code class="language-powershell"># IIS と管理ツールをインストール
Install-WindowsFeature -Name Web-Server -IncludeManagementTools

# 追加機能のインストール（例: ASP.NET 4.8）
Install-WindowsFeature -Name Web-Asp-Net45

# インストール確認
Get-WindowsFeature | Where-Object { $_.InstallState -eq "Installed" -and $_.Name -like "Web-*" }
</code></pre>

<h2>インストール後の確認</h2>
<p>ブラウザで <code>http://localhost</code> にアクセスし、IIS のデフォルトページが表示されれば成功です。</p>
`
  },
  {
    id: 'setup-first-site',
    title: '最初のサイト作成',
    section: 'setup',
    sectionLabel: 'インストール・セットアップ',
    order: 3,
    content: `
<h1>最初のサイト作成</h1>
<p>IIS マネージャーを使用して新しい Web サイトを作成する手順です。</p>

<h2>IIS マネージャーでのサイト作成</h2>
<ol>
  <li>IIS マネージャー（inetmgr）を開く</li>
  <li>左ペインでサーバー名を右クリック → [サイトの追加]</li>
  <li>サイト名、物理パス、バインド情報を入力</li>
  <li>[OK] をクリック</li>
</ol>

<h2>コンテンツの配置</h2>
<pre><code>C:\\inetpub\\wwwroot\\mysite\\
  ├── index.html
  ├── css\\
  ├── js\\
  └── web.config
</code></pre>

<blockquote>
  <p><strong>Tip:</strong> 本番環境では <code>C:\\inetpub\\wwwroot</code> 以外のドライブにコンテンツを配置することを推奨します。</p>
</blockquote>
`
  },

  /* ==============================================================
     セクション: IIS 基本設定
     ============================================================== */
  {
    id: 'config-app-pools',
    title: 'アプリケーションプール',
    section: 'config',
    sectionLabel: 'IIS 基本設定',
    order: 1,
    content: `
<h1>アプリケーションプール</h1>
<p>アプリケーションプールは IIS の重要な概念です。各 Web サイトやアプリケーションを
独立したプロセスで実行することで、安定性とセキュリティを確保します。</p>

<h2>アプリケーションプールの設定項目</h2>
<table>
  <thead>
    <tr><th>設定項目</th><th>推奨値</th><th>説明</th></tr>
  </thead>
  <tbody>
    <tr><td>.NET CLR バージョン</td><td>v4.0 または マネージドコードなし</td><td>使用するフレームワークに合わせる</td></tr>
    <tr><td>マネージドパイプラインモード</td><td>統合</td><td>新しいアプリケーションには統合モードを使用</td></tr>
    <tr><td>アイドルタイムアウト</td><td>20分</td><td>未使用時のプロセス停止までの時間</td></tr>
    <tr><td>定期的な再起動</td><td>1740分（29時間）</td><td>メモリリーク対策の定期再起動</td></tr>
  </tbody>
</table>

<h2>PowerShell での管理</h2>
<pre><code class="language-powershell"># アプリケーションプールの作成
New-WebAppPool -Name "MyAppPool"

# 設定変更
Set-ItemProperty IIS:\\AppPools\\MyAppPool -Name processModel.idleTimeout -Value "00:20:00"

# 再起動
Restart-WebAppPool -Name "MyAppPool"
</code></pre>
`
  },
  {
    id: 'config-bindings',
    title: 'バインディング設定',
    section: 'config',
    sectionLabel: 'IIS 基本設定',
    order: 2,
    content: `
<h1>バインディング設定</h1>
<p>バインディングは、IIS サイトがどの IP アドレス・ポート・ホスト名でリクエストを
受け付けるかを定義します。</p>

<h2>バインディングの追加（PowerShell）</h2>
<pre><code class="language-powershell"># HTTP バインディング追加
New-WebBinding -Name "MySite" -Protocol "http" -Port 80 -HostHeader "www.example.com"

# HTTPS バインディング追加
New-WebBinding -Name "MySite" -Protocol "https" -Port 443 -HostHeader "www.example.com"

# SSL 証明書の割り当て
$cert = Get-ChildItem Cert:\\LocalMachine\\My | Where-Object { $_.Subject -like "*example.com*" }
$binding = Get-WebBinding -Name "MySite" -Protocol "https"
$binding.AddSslCertificate($cert.Thumbprint, "My")
</code></pre>

<h2>ホストヘッダーによる複数サイトの運用</h2>
<p>1つの IP アドレスで複数のドメインをホストする場合、ホストヘッダーを使用します。</p>
<pre><code>サイト A: www.example.com  → ポート 443
サイト B: api.example.com  → ポート 443
サイト C: admin.example.com → ポート 443
</code></pre>
`
  },
  {
    id: 'config-webconfig',
    title: 'web.config の基本',
    section: 'config',
    sectionLabel: 'IIS 基本設定',
    order: 3,
    content: `
<h1>web.config の基本</h1>
<p><code>web.config</code> は IIS Web アプリケーションの設定ファイルです。
アプリケーションのルートディレクトリに配置します。</p>

<h2>基本構造</h2>
<pre><code class="language-xml">&lt;?xml version="1.0" encoding="UTF-8"?&gt;
&lt;configuration&gt;
  &lt;system.web&gt;
    &lt;!-- ASP.NET 設定 --&gt;
    &lt;compilation debug="false" targetFramework="4.8" /&gt;
    &lt;httpRuntime targetFramework="4.8" maxRequestLength="4096" /&gt;
  &lt;/system.web&gt;

  &lt;system.webServer&gt;
    &lt;!-- IIS 設定 --&gt;
    &lt;defaultDocument&gt;
      &lt;files&gt;
        &lt;add value="index.html" /&gt;
      &lt;/files&gt;
    &lt;/defaultDocument&gt;
  &lt;/system.webServer&gt;
&lt;/configuration&gt;
</code></pre>

<h2>主要な設定セクション</h2>
<ul>
  <li><code>&lt;system.web&gt;</code> - ASP.NET アプリケーション設定</li>
  <li><code>&lt;system.webServer&gt;</code> - IIS 固有の設定</li>
  <li><code>&lt;appSettings&gt;</code> - アプリケーション固有のキー/値設定</li>
  <li><code>&lt;connectionStrings&gt;</code> - データベース接続文字列</li>
</ul>
`
  },

  /* ==============================================================
     セクション: セキュリティ設定
     ============================================================== */
  {
    id: 'security-ssl',
    title: 'SSL/TLS 設定',
    section: 'security',
    sectionLabel: 'セキュリティ設定',
    order: 1,
    content: `
<h1>SSL/TLS 設定</h1>
<p>Azure 上の IIS では、SSL/TLS 証明書を使用して通信を暗号化します。</p>

<h2>証明書の取得方法</h2>
<ul>
  <li><strong>Azure App Service 証明書</strong> - マネージド証明書（推奨）</li>
  <li><strong>Let's Encrypt</strong> - 無料の自動更新証明書</li>
  <li><strong>商用 CA</strong> - DigiCert、Sectigo 等</li>
</ul>

<h2>TLS バージョンの設定</h2>
<pre><code class="language-powershell"># TLS 1.2 を有効化（レジストリ設定）
$path = "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\SecurityProviders\\SCHANNEL\\Protocols"

# TLS 1.2 Server の有効化
New-Item "$path\\TLS 1.2\\Server" -Force
New-ItemProperty -Path "$path\\TLS 1.2\\Server" -Name "Enabled" -Value 1 -PropertyType DWORD -Force
New-ItemProperty -Path "$path\\TLS 1.2\\Server" -Name "DisabledByDefault" -Value 0 -PropertyType DWORD -Force

# TLS 1.0, 1.1 の無効化（セキュリティ強化）
New-Item "$path\\TLS 1.0\\Server" -Force
New-ItemProperty -Path "$path\\TLS 1.0\\Server" -Name "Enabled" -Value 0 -PropertyType DWORD -Force
</code></pre>

<blockquote>
  <p><strong>Warning:</strong> TLS 1.0/1.1 を無効化する前に、クライアントの互換性を必ず確認してください。</p>
</blockquote>
`
  },
  {
    id: 'security-auth',
    title: '認証設定',
    section: 'security',
    sectionLabel: 'セキュリティ設定',
    order: 2,
    content: `
<h1>認証設定</h1>
<p>IIS では複数の認証方式をサポートしています。用途に応じて適切な方式を選択します。</p>

<h2>認証方式の比較</h2>
<table>
  <thead>
    <tr><th>認証方式</th><th>用途</th><th>セキュリティ</th></tr>
  </thead>
  <tbody>
    <tr><td>匿名認証</td><td>公開 Web サイト</td><td>なし</td></tr>
    <tr><td>基本認証</td><td>シンプルな保護（HTTPS 必須）</td><td>低〜中</td></tr>
    <tr><td>Windows 認証</td><td>社内イントラネット</td><td>高</td></tr>
    <tr><td>フォーム認証</td><td>ASP.NET アプリケーション</td><td>中〜高</td></tr>
    <tr><td>Azure AD / OIDC</td><td>クラウド・モダンアプリ</td><td>高</td></tr>
  </tbody>
</table>

<h2>Windows 認証の有効化</h2>
<pre><code class="language-powershell"># Windows 認証の有効化
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WindowsAuthentication

# 匿名認証の無効化
Set-WebConfigurationProperty -Filter "/system.webServer/security/authentication/anonymousAuthentication" \`
    -Name "enabled" -Value "False" -PSPath "IIS:\\" -Location "MySite"

# Windows 認証の有効化
Set-WebConfigurationProperty -Filter "/system.webServer/security/authentication/windowsAuthentication" \`
    -Name "enabled" -Value "True" -PSPath "IIS:\\" -Location "MySite"
</code></pre>
`
  },
  {
    id: 'security-headers',
    title: 'セキュリティヘッダー',
    section: 'security',
    sectionLabel: 'セキュリティ設定',
    order: 3,
    content: `
<h1>セキュリティヘッダー</h1>
<p>HTTP レスポンスヘッダーを適切に設定することで、XSS やクリックジャッキング等の
攻撃を軽減できます。</p>

<h2>推奨セキュリティヘッダー</h2>
<pre><code class="language-xml">&lt;system.webServer&gt;
  &lt;httpProtocol&gt;
    &lt;customHeaders&gt;
      &lt;!-- サーバー情報の隠蔽 --&gt;
      &lt;remove name="X-Powered-By" /&gt;

      &lt;!-- MIME タイプスニッフィングの防止 --&gt;
      &lt;add name="X-Content-Type-Options" value="nosniff" /&gt;

      &lt;!-- クリックジャッキング対策 --&gt;
      &lt;add name="X-Frame-Options" value="SAMEORIGIN" /&gt;

      &lt;!-- XSS フィルター --&gt;
      &lt;add name="X-XSS-Protection" value="1; mode=block" /&gt;

      &lt;!-- HTTPS 強制（HSTS） --&gt;
      &lt;add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" /&gt;

      &lt;!-- リファラーポリシー --&gt;
      &lt;add name="Referrer-Policy" value="strict-origin-when-cross-origin" /&gt;
    &lt;/customHeaders&gt;
  &lt;/httpProtocol&gt;
&lt;/system.webServer&gt;
</code></pre>
`
  },

  /* ==============================================================
     セクション: Azure デプロイ
     ============================================================== */
  {
    id: 'azure-appservice',
    title: 'Azure App Service',
    section: 'azure',
    sectionLabel: 'Azure デプロイ',
    order: 1,
    content: `
<h1>Azure App Service</h1>
<p>Azure App Service は、IIS をマネージドサービスとして利用できる PaaS です。
インフラ管理不要で Web アプリケーションをデプロイできます。</p>

<h2>App Service の作成</h2>
<pre><code class="language-bash"># Azure CLI でのリソース作成
az group create --name myResourceGroup --location japaneast

az appservice plan create \
  --name myAppServicePlan \
  --resource-group myResourceGroup \
  --sku B1 \
  --is-windows

az webapp create \
  --name myWebApp \
  --resource-group myResourceGroup \
  --plan myAppServicePlan \
  --runtime "DOTNET|6.0"
</code></pre>

<h2>デプロイ方法</h2>
<ul>
  <li><strong>ZIP デプロイ</strong> - シンプルなファイルのアップロード</li>
  <li><strong>GitHub Actions</strong> - CI/CD パイプライン</li>
  <li><strong>Azure DevOps</strong> - エンタープライズ CI/CD</li>
  <li><strong>FTP/FTPS</strong> - レガシー互換</li>
  <li><strong>Visual Studio 発行</strong> - 開発環境からの直接デプロイ</li>
</ul>
`
  },
  {
    id: 'azure-vm',
    title: 'Azure VM + IIS',
    section: 'azure',
    sectionLabel: 'Azure デプロイ',
    order: 2,
    content: `
<h1>Azure VM + IIS</h1>
<p>Azure 仮想マシン上に IIS を構築する方法です。
より細かい設定が必要な場合や、既存の IIS 構成を移行する際に使用します。</p>

<h2>VM の作成</h2>
<pre><code class="language-bash"># Windows Server 2022 VM の作成
az vm create \
  --resource-group myResourceGroup \
  --name myIISVM \
  --image Win2022AzureEditionCore \
  --admin-username azureuser \
  --admin-password "YourSecurePassword123!" \
  --size Standard_B2s

# HTTP/HTTPS ポートの開放
az vm open-port --resource-group myResourceGroup --name myIISVM --port 80
az vm open-port --resource-group myResourceGroup --name myIISVM --port 443 --priority 901
</code></pre>

<h2>IIS のリモートインストール</h2>
<pre><code class="language-powershell"># Azure VM の拡張機能を使用した IIS インストール
az vm extension set \
  --resource-group myResourceGroup \
  --vm-name myIISVM \
  --name CustomScriptExtension \
  --publisher Microsoft.Compute \
  --settings '{"commandToExecute":"powershell Add-WindowsFeature Web-Server -IncludeManagementTools"}'
</code></pre>
`
  },

  /* ==============================================================
     セクション: トラブルシューティング
     ============================================================== */
  {
    id: 'trouble-http-errors',
    title: 'HTTP エラーコード一覧',
    section: 'trouble',
    sectionLabel: 'トラブルシューティング',
    order: 1,
    content: `
<h1>HTTP エラーコード一覧</h1>
<p>IIS でよく発生する HTTP エラーコードと対処方法を説明します。</p>

<h2>4xx クライアントエラー</h2>
<table>
  <thead>
    <tr><th>コード</th><th>名称</th><th>主な原因</th><th>対処</th></tr>
  </thead>
  <tbody>
    <tr><td>400</td><td>Bad Request</td><td>不正なリクエスト形式</td><td>クライアント側のリクエストを確認</td></tr>
    <tr><td>401</td><td>Unauthorized</td><td>認証エラー</td><td>認証設定・資格情報を確認</td></tr>
    <tr><td>403</td><td>Forbidden</td><td>アクセス権限なし</td><td>NTFS 権限・IIS 権限を確認</td></tr>
    <tr><td>404</td><td>Not Found</td><td>ファイルが存在しない</td><td>ファイルパス・URL マッピングを確認</td></tr>
    <tr><td>405</td><td>Method Not Allowed</td><td>HTTP メソッドが不許可</td><td>ハンドラーマッピングを確認</td></tr>
  </tbody>
</table>

<h2>5xx サーバーエラー</h2>
<table>
  <thead>
    <tr><th>コード</th><th>名称</th><th>主な原因</th><th>対処</th></tr>
  </thead>
  <tbody>
    <tr><td>500</td><td>Internal Server Error</td><td>アプリケーションエラー</td><td>IIS ログ・イベントログを確認</td></tr>
    <tr><td>502</td><td>Bad Gateway</td><td>バックエンドとの通信エラー</td><td>リバースプロキシ設定を確認</td></tr>
    <tr><td>503</td><td>Service Unavailable</td><td>アプリプールの停止</td><td>アプリプールを再起動</td></tr>
  </tbody>
</table>
`
  },
  {
    id: 'trouble-logs',
    title: 'IIS ログの確認',
    section: 'trouble',
    sectionLabel: 'トラブルシューティング',
    order: 2,
    content: `
<h1>IIS ログの確認</h1>
<p>問題発生時はまず IIS ログを確認します。デフォルトのログ保存場所は
<code>C:\\inetpub\\logs\\LogFiles</code> です。</p>

<h2>ログファイルの形式（W3C 形式）</h2>
<pre><code>#Software: Microsoft Internet Information Services 10.0
#Version: 1.0
#Date: 2024-01-15 00:00:00
#Fields: date time c-ip cs-method cs-uri-stem cs-uri-query sc-status time-taken

2024-01-15 09:23:45 192.168.1.100 GET /index.html - 200 45
2024-01-15 09:23:46 192.168.1.100 GET /api/data   - 500 1203
</code></pre>

<h2>PowerShell でのログ分析</h2>
<pre><code class="language-powershell"># 500 エラーの抽出
Get-Content "C:\\inetpub\\logs\\LogFiles\\W3SVC1\\u_ex240115.log" |
    Where-Object { $_ -match " 500 " } |
    Select-Object -Last 20

# リクエスト数の多い URI を集計
Import-Csv "C:\\inetpub\\logs\\LogFiles\\W3SVC1\\u_ex240115.log" \`
    -Delimiter " " -Header "date","time","c-ip","cs-method","cs-uri-stem","sc-status","time-taken" |
    Group-Object "cs-uri-stem" |
    Sort-Object Count -Descending |
    Select-Object -First 10
</code></pre>
`
  },
  {
    id: 'trouble-frt',
    title: '失敗したリクエストのトレース',
    section: 'trouble',
    sectionLabel: 'トラブルシューティング',
    order: 3,
    content: `
<h1>失敗したリクエストのトレース（FRT）</h1>
<p>失敗したリクエストのトレース（Failed Request Tracing）は、
エラーの詳細な原因調査に役立つ IIS の機能です。</p>

<h2>有効化の手順</h2>
<ol>
  <li>IIS マネージャーでサイトを選択</li>
  <li>[失敗したリクエストのトレース] をダブルクリック</li>
  <li>[有効] にチェックを入れてパスを指定</li>
  <li>トレースするルールを追加（例: ステータスコード 500）</li>
</ol>

<h2>web.config での設定</h2>
<pre><code class="language-xml">&lt;system.webServer&gt;
  &lt;tracing&gt;
    &lt;traceFailedRequests&gt;
      &lt;add path="*"&gt;
        &lt;traceAreas&gt;
          &lt;add provider="ASP" verbosity="Verbose" /&gt;
          &lt;add provider="ASPNET" areas="Infrastructure,Module,Page,AppServices" verbosity="Verbose" /&gt;
          &lt;add provider="ISAPI Extension" verbosity="Verbose" /&gt;
          &lt;add provider="WWW Server" areas="Authentication,Security,Filter,StaticFile,CGI,Compression,Cache,RequestNotifications,Module" verbosity="Verbose" /&gt;
        &lt;/traceAreas&gt;
        &lt;failureDefinitions statusCodes="400-599" /&gt;
      &lt;/add&gt;
    &lt;/traceFailedRequests&gt;
  &lt;/tracing&gt;
&lt;/system.webServer&gt;
</code></pre>

<blockquote>
  <p><strong>Note:</strong> トレースログはサイズが大きくなるため、問題解決後は無効化することを推奨します。</p>
</blockquote>
`
  },

  /* ==============================================================
     セクション: リファレンス
     ============================================================== */
  {
    id: 'ref-webconfig-schema',
    title: 'web.config スキーマ',
    section: 'reference',
    sectionLabel: 'リファレンス',
    order: 1,
    content: `
<h1>web.config スキーマリファレンス</h1>
<p><code>web.config</code> の主要な設定要素の一覧です。</p>

<h2>system.webServer 要素</h2>
<table>
  <thead>
    <tr><th>要素</th><th>説明</th></tr>
  </thead>
  <tbody>
    <tr><td><code>defaultDocument</code></td><td>デフォルトドキュメントの設定</td></tr>
    <tr><td><code>staticContent</code></td><td>静的コンテンツの MIME タイプ設定</td></tr>
    <tr><td><code>rewrite</code></td><td>URL 書き換えルール（URL Rewrite モジュール）</td></tr>
    <tr><td><code>httpProtocol</code></td><td>HTTP プロトコル設定（カスタムヘッダー等）</td></tr>
    <tr><td><code>security</code></td><td>認証・認可・リクエストフィルタリング</td></tr>
    <tr><td><code>httpErrors</code></td><td>カスタムエラーページの設定</td></tr>
    <tr><td><code>httpCompression</code></td><td>コンテンツ圧縮の設定</td></tr>
    <tr><td><code>urlCompression</code></td><td>URL 圧縮の有効/無効</td></tr>
    <tr><td><code>modules</code></td><td>HTTP モジュールの追加/削除</td></tr>
    <tr><td><code>handlers</code></td><td>HTTP ハンドラーの設定</td></tr>
  </tbody>
</table>
`
  },
  {
    id: 'ref-appcmd',
    title: 'IIS コマンドライン (appcmd)',
    section: 'reference',
    sectionLabel: 'リファレンス',
    order: 2,
    content: `
<h1>IIS コマンドライン (appcmd)</h1>
<p><code>appcmd.exe</code> は IIS の設定をコマンドラインから管理するツールです。
<code>C:\\Windows\\System32\\inetsrv\\appcmd.exe</code> に配置されています。</p>

<h2>主要コマンド</h2>
<pre><code class="language-cmd">:: サイト一覧の表示
appcmd list site

:: アプリプール一覧の表示
appcmd list apppool

:: サイトの作成
appcmd add site /name:MySite /physicalPath:C:\\inetpub\\wwwroot\\mysite /bindings:http/*:80:

:: アプリプールの作成
appcmd add apppool /name:MyPool /managedRuntimeVersion:v4.0

:: サイトの開始・停止
appcmd start site /site.name:MySite
appcmd stop site /site.name:MySite

:: アプリプールの再起動
appcmd recycle apppool /apppool.name:MyPool

:: ワーカープロセスの一覧
appcmd list wp
</code></pre>

<h2>PowerShell WebAdministration モジュール</h2>
<pre><code class="language-powershell"># モジュールのインポート
Import-Module WebAdministration

# IIS ドライブへのアクセス
Get-ChildItem IIS:\\Sites
Get-ChildItem IIS:\\AppPools

# サイト情報の取得
Get-Website -Name "Default Web Site"

# バインディングの取得
Get-WebBinding -Name "MySite"
</code></pre>
`
  }
];
