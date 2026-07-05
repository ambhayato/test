/**
 * content.js
 * マニュアルのページ定義（メタデータのみ）。
 *
 * コンテンツ本文は docs/pages/<id>.html に個別 HTML ファイルとして管理します。
 * ページの追加・編集は pages/ フォルダの HTML ファイルを直接編集してください。
 *
 * 各エントリの構造:
 *   id           {string}  URL クエリパラメータ (?page=xxx) のスラッグ / ファイル名
 *   title        {string}  ページタイトル（TOC・パンくず・ブラウザタイトルに使用）
 *   section      {string}  親セクションの id
 *   sectionLabel {string}  TOC のセクション見出し
 *   order        {number}  同一セクション内での表示順
 */

const MANUAL_CONTENT = [

  /* はじめに */
  { id: 'intro-overview',      title: '概要',                  section: 'intro',    sectionLabel: 'はじめに',               order: 1 },
  { id: 'intro-architecture',  title: 'アーキテクチャ概要',    section: 'intro',    sectionLabel: 'はじめに',               order: 2 },

  /* インストール・セットアップ */
  { id: 'setup-prerequisites', title: '前提条件',              section: 'setup',    sectionLabel: 'インストール・セットアップ', order: 1 },
  { id: 'setup-iis-install',   title: 'IIS のインストール',    section: 'setup',    sectionLabel: 'インストール・セットアップ', order: 2 },
  { id: 'setup-first-site',    title: '最初のサイト作成',      section: 'setup',    sectionLabel: 'インストール・セットアップ', order: 3 },

  /* IIS 基本設定 */
  { id: 'config-app-pools',    title: 'アプリケーションプール', section: 'config',   sectionLabel: 'IIS 基本設定',           order: 1 },
  { id: 'config-bindings',     title: 'バインディング設定',    section: 'config',   sectionLabel: 'IIS 基本設定',           order: 2 },
  { id: 'config-webconfig',    title: 'web.config の基本',     section: 'config',   sectionLabel: 'IIS 基本設定',           order: 3 },

  /* セキュリティ設定 */
  { id: 'security-ip-restriction', title: 'IPアドレス制限',       section: 'security', sectionLabel: 'セキュリティ設定',       order: 1 },
  { id: 'security-ssl',            title: 'SSL/TLS 設定',          section: 'security', sectionLabel: 'セキュリティ設定',       order: 2 },
  { id: 'security-auth',           title: '認証設定',              section: 'security', sectionLabel: 'セキュリティ設定',       order: 3 },
  { id: 'security-headers',        title: 'セキュリティヘッダー',  section: 'security', sectionLabel: 'セキュリティ設定',       order: 4 },

  /* Azure デプロイ */
  { id: 'azure-appservice',    title: 'Azure App Service',     section: 'azure',    sectionLabel: 'Azure デプロイ',         order: 1 },
  { id: 'azure-vm',            title: 'Azure VM + IIS',        section: 'azure',    sectionLabel: 'Azure デプロイ',         order: 2 },

  /* トラブルシューティング */
  { id: 'trouble-http-errors', title: 'HTTP エラーコード一覧', section: 'trouble',  sectionLabel: 'トラブルシューティング', order: 1 },
  { id: 'trouble-logs',        title: 'IIS ログの確認',        section: 'trouble',  sectionLabel: 'トラブルシューティング', order: 2 },
  { id: 'trouble-frt',         title: '失敗したリクエストのトレース', section: 'trouble', sectionLabel: 'トラブルシューティング', order: 3 },

  /* リファレンス */
  { id: 'ref-webconfig-schema', title: 'web.config スキーマ',         section: 'reference', sectionLabel: 'リファレンス', order: 1 },
  { id: 'ref-appcmd',           title: 'IIS コマンドライン (appcmd)', section: 'reference', sectionLabel: 'リファレンス', order: 2 },

];
