/**
 * app.js
 * TOC レンダリング・ページルーティング・ナビゲーション
 *
 * 依存: content.js (MANUAL_CONTENT が定義済みであること)
 */

;(function () {
  'use strict';

  /* ----------------------------------------------------------------
     セクション定義（content.js の sectionLabel から自動収集）
  ---------------------------------------------------------------- */
  const SECTIONS = (function () {
    const map = new Map();
    MANUAL_CONTENT.forEach(function (page) {
      if (!map.has(page.section)) {
        map.set(page.section, { id: page.section, label: page.sectionLabel });
      }
    });
    return Array.from(map.values());
  })();

  /* ----------------------------------------------------------------
     ページのフラットリスト（order 順）
  ---------------------------------------------------------------- */
  const ALL_PAGES = MANUAL_CONTENT.slice().sort(function (a, b) {
    const secA = SECTIONS.findIndex(function (s) { return s.id === a.section; });
    const secB = SECTIONS.findIndex(function (s) { return s.id === b.section; });
    if (secA !== secB) return secA - secB;
    return a.order - b.order;
  });

  /* ----------------------------------------------------------------
     現在表示中のページ ID
  ---------------------------------------------------------------- */
  let currentPageId = null;

  /* ----------------------------------------------------------------
     DOM ヘルパー
  ---------------------------------------------------------------- */
  function qs(selector) { return document.querySelector(selector); }

  /* ----------------------------------------------------------------
     TOC の構築
  ---------------------------------------------------------------- */
  function buildTOC() {
    var tocNav = qs('#toc-nav');
    if (!tocNav) return;

    var ul = document.createElement('ul');

    SECTIONS.forEach(function (section) {
      var pages = ALL_PAGES.filter(function (p) { return p.section === section.id; });
      if (!pages.length) return;

      var li = document.createElement('li');

      // セクションボタン
      var btn = document.createElement('button');
      btn.className = 'toc-section-btn';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'toc-pages-' + section.id);
      btn.setAttribute('data-section', section.id);
      btn.innerHTML =
        '<span>' + escapeHtml(section.label) + '</span>' +
        '<svg class="toc-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
          '<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"' +
          ' stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      btn.addEventListener('click', function () {
        var pageList = qs('#toc-pages-' + section.id);
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        pageList.classList.toggle('open', !expanded);
        // 状態を sessionStorage に保存
        try {
          var openSections = JSON.parse(sessionStorage.getItem('toc-open') || '[]');
          if (!expanded) {
            if (!openSections.includes(section.id)) openSections.push(section.id);
          } else {
            openSections = openSections.filter(function (id) { return id !== section.id; });
          }
          sessionStorage.setItem('toc-open', JSON.stringify(openSections));
        } catch (e) { /* sessionStorage 無効環境では無視 */ }
      });

      // ページリスト
      var pageUl = document.createElement('ul');
      pageUl.className = 'toc-pages';
      pageUl.id = 'toc-pages-' + section.id;

      pages.forEach(function (page) {
        var pageLi = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'toc-page-link';
        a.textContent = page.title;
        a.href = '?page=' + page.id;
        a.setAttribute('data-page-id', page.id);
        a.addEventListener('click', function (e) {
          e.preventDefault();
          loadPage(page.id);
          // モバイル: クリック後にサイドバーを閉じる
          if (window.innerWidth <= 768) closeSidebar();
        });
        pageLi.appendChild(a);
        pageUl.appendChild(pageLi);
      });

      li.appendChild(btn);
      li.appendChild(pageUl);
      ul.appendChild(li);
    });

    tocNav.appendChild(ul);

    // sessionStorage から開いているセクションを復元
    restoreTOCState();
  }

  /* ----------------------------------------------------------------
     sessionStorage からTOC の開閉状態を復元
  ---------------------------------------------------------------- */
  function restoreTOCState() {
    var openSections;
    try {
      openSections = JSON.parse(sessionStorage.getItem('toc-open') || '[]');
    } catch (e) {
      openSections = [];
    }
    openSections.forEach(function (sectionId) {
      var btn = qs('[data-section="' + sectionId + '"]');
      var pageList = qs('#toc-pages-' + sectionId);
      if (btn && pageList) {
        btn.setAttribute('aria-expanded', 'true');
        pageList.classList.add('open');
      }
    });
  }

  /* ----------------------------------------------------------------
     ページのロード（コンテンツ注入）
  ---------------------------------------------------------------- */
  function loadPage(pageId) {
    var page = MANUAL_CONTENT.find(function (p) { return p.id === pageId; });
    if (!page) {
      showNotFound(pageId);
      return;
    }

    currentPageId = pageId;

    // URL 更新（ブラウザ履歴）
    var newUrl = '?page=' + pageId;
    if (window.location.search !== newUrl) {
      history.pushState({ page: pageId }, page.title, newUrl);
    }

    // ページタイトル更新
    document.title = page.title + ' - Web マニュアル';

    // コンテンツ注入
    var contentBody = qs('#content-body');
    if (contentBody) {
      contentBody.innerHTML = page.content;
    }

    // パンくずリスト更新
    updateBreadcrumb(page);

    // TOC アクティブリンク更新
    setActiveLink(pageId, page.section);

    // 前へ/次へナビゲーション更新
    updatePageNav(pageId);

    // スクロールをトップへ
    var contentArea = qs('.content-area');
    if (contentArea) contentArea.scrollTop = 0;
  }

  /* ----------------------------------------------------------------
     ページが見つからない場合の表示
  ---------------------------------------------------------------- */
  function showNotFound(pageId) {
    var contentBody = qs('#content-body');
    if (contentBody) {
      contentBody.innerHTML =
        '<h1>ページが見つかりません</h1>' +
        '<p>指定されたページ "<code>' + escapeHtml(pageId) + '</code>" は存在しません。</p>' +
        '<p><a href="?page=' + ALL_PAGES[0].id + '">最初のページへ</a></p>';
    }
  }

  /* ----------------------------------------------------------------
     パンくずリストの更新
  ---------------------------------------------------------------- */
  function updateBreadcrumb(page) {
    var section = SECTIONS.find(function (s) { return s.id === page.section; });
    var bcSection = qs('#breadcrumb-section');
    var bcPage    = qs('#breadcrumb-page');
    var bcSep     = qs('#breadcrumb-sep');
    if (!bcSection || !bcPage || !bcSep) return;

    if (section) {
      bcSection.textContent = section.label;
      bcPage.textContent    = page.title;
      bcSep.style.display   = 'inline';
    } else {
      bcSection.textContent = page.title;
      bcPage.textContent    = '';
      bcSep.style.display   = 'none';
    }
  }

  /* ----------------------------------------------------------------
     TOC アクティブリンクの更新
  ---------------------------------------------------------------- */
  function setActiveLink(pageId, sectionId) {
    // 全リンクの active クラスを外す
    document.querySelectorAll('.toc-page-link').forEach(function (link) {
      link.classList.remove('active');
    });

    // 対象リンクに active を付ける
    var activeLink = qs('[data-page-id="' + pageId + '"]');
    if (activeLink) {
      activeLink.classList.add('active');
      // 対応セクションを展開
      openSection(sectionId);
    }
  }

  /* ----------------------------------------------------------------
     セクションを開く
  ---------------------------------------------------------------- */
  function openSection(sectionId) {
    var btn = qs('[data-section="' + sectionId + '"]');
    var pageList = qs('#toc-pages-' + sectionId);
    if (btn && pageList && !pageList.classList.contains('open')) {
      btn.setAttribute('aria-expanded', 'true');
      pageList.classList.add('open');
    }
  }

  /* ----------------------------------------------------------------
     前へ/次へナビゲーションの更新
  ---------------------------------------------------------------- */
  function updatePageNav(pageId) {
    var idx = ALL_PAGES.findIndex(function (p) { return p.id === pageId; });
    var btnPrev  = qs('#btn-prev');
    var btnNext  = qs('#btn-next');
    var prevTitle = qs('#prev-title');
    var nextTitle = qs('#next-title');
    if (!btnPrev || !btnNext) return;

    var prevPage = idx > 0 ? ALL_PAGES[idx - 1] : null;
    var nextPage = idx < ALL_PAGES.length - 1 ? ALL_PAGES[idx + 1] : null;

    if (prevPage) {
      btnPrev.classList.remove('hidden');
      prevTitle.textContent = prevPage.title;
      btnPrev.onclick = function () { loadPage(prevPage.id); };
    } else {
      btnPrev.classList.add('hidden');
    }

    if (nextPage) {
      btnNext.classList.remove('hidden');
      nextTitle.textContent = nextPage.title;
      btnNext.onclick = function () { loadPage(nextPage.id); };
    } else {
      btnNext.classList.add('hidden');
    }
  }

  /* ----------------------------------------------------------------
     モバイル: サイドバー開閉
  ---------------------------------------------------------------- */
  function openSidebar() {
    document.body.classList.add('sidebar-open');
    var overlay = qs('#sidebar-overlay');
    var hamburger = qs('#hamburger-btn');
    if (overlay) overlay.style.display = 'block';
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    var overlay = qs('#sidebar-overlay');
    var hamburger = qs('#hamburger-btn');
    if (overlay) overlay.style.display = 'none';
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  function initMobileMenu() {
    var hamburger = qs('#hamburger-btn');
    var overlay   = qs('#sidebar-overlay');

    if (hamburger) {
      hamburger.addEventListener('click', function () {
        if (document.body.classList.contains('sidebar-open')) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }
  }

  /* ----------------------------------------------------------------
     ルーター: 初期ページの決定
  ---------------------------------------------------------------- */
  function initRouter() {
    // ブラウザの戻る/進む対応
    window.addEventListener('popstate', function (e) {
      var pageId = (e.state && e.state.page) || getPageFromUrl();
      if (pageId) {
        loadPage(pageId);
      } else if (ALL_PAGES.length) {
        loadPage(ALL_PAGES[0].id);
      }
    });

    // 初期ページの読み込み
    var initialPageId = getPageFromUrl();
    if (initialPageId) {
      loadPage(initialPageId);
    } else if (ALL_PAGES.length) {
      loadPage(ALL_PAGES[0].id);
    }
  }

  /* ----------------------------------------------------------------
     URL クエリパラメータからページ ID を取得
  ---------------------------------------------------------------- */
  function getPageFromUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('page') || '';
  }

  /* ----------------------------------------------------------------
     HTML エスケープ
  ---------------------------------------------------------------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ----------------------------------------------------------------
     パブリック API（search.js から利用）
  ---------------------------------------------------------------- */
  window.ManualApp = {
    loadPage: loadPage,
    getAllPages: function () { return ALL_PAGES; },
    getSections: function () { return SECTIONS; }
  };

  /* ----------------------------------------------------------------
     初期化
  ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    buildTOC();
    initMobileMenu();
    initRouter();
  });

})();
