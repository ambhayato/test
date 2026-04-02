/**
 * app.js
 * TOC レンダリング・ページルーティング・ナビゲーション
 *
 * 各ページのコンテンツは docs/pages/<id>.html から fetch() で読み込みます。
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
     ページのフラットリスト（セクション順 → order 順）
  ---------------------------------------------------------------- */
  const ALL_PAGES = MANUAL_CONTENT.slice().sort(function (a, b) {
    const secA = SECTIONS.findIndex(function (s) { return s.id === a.section; });
    const secB = SECTIONS.findIndex(function (s) { return s.id === b.section; });
    if (secA !== secB) return secA - secB;
    return a.order - b.order;
  });

  /* ----------------------------------------------------------------
     フェッチキャッシュ（同一ページを複数回取得しない）
  ---------------------------------------------------------------- */
  const pageCache = {};

  /* ----------------------------------------------------------------
     DOM ヘルパー
  ---------------------------------------------------------------- */
  function qs(selector) { return document.querySelector(selector); }

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
        saveTOCState(section.id, !expanded);
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
    restoreTOCState();
  }

  /* ----------------------------------------------------------------
     sessionStorage で TOC の開閉状態を保存・復元
  ---------------------------------------------------------------- */
  function saveTOCState(sectionId, isOpen) {
    try {
      var open = JSON.parse(sessionStorage.getItem('toc-open') || '[]');
      if (isOpen) {
        if (!open.includes(sectionId)) open.push(sectionId);
      } else {
        open = open.filter(function (id) { return id !== sectionId; });
      }
      sessionStorage.setItem('toc-open', JSON.stringify(open));
    } catch (e) { /* ignore */ }
  }

  function restoreTOCState() {
    var open;
    try { open = JSON.parse(sessionStorage.getItem('toc-open') || '[]'); }
    catch (e) { open = []; }
    open.forEach(function (sectionId) {
      var btn      = qs('[data-section="' + sectionId + '"]');
      var pageList = qs('#toc-pages-' + sectionId);
      if (btn && pageList) {
        btn.setAttribute('aria-expanded', 'true');
        pageList.classList.add('open');
      }
    });
  }

  /* ----------------------------------------------------------------
     ページのロード（fetch → コンテンツ注入）
  ---------------------------------------------------------------- */
  function loadPage(pageId) {
    var page = MANUAL_CONTENT.find(function (p) { return p.id === pageId; });
    if (!page) { showNotFound(pageId); return; }

    var contentBody = qs('#content-body');
    if (!contentBody) return;

    // URL・タイトル・TOC・パンくず・ページナビを先に更新（即時）
    var newUrl = '?page=' + pageId;
    if (window.location.search !== newUrl) {
      history.pushState({ page: pageId }, page.title, newUrl);
    }
    document.title = page.title + ' - Web マニュアル';
    updateBreadcrumb(page);
    setActiveLink(pageId, page.section);
    updatePageNav(pageId);

    // キャッシュ済みならそのまま注入
    if (pageCache[pageId]) {
      contentBody.innerHTML = pageCache[pageId];
      scrollContentTop();
      return;
    }

    // ロード中インジケーター
    contentBody.innerHTML = '<div class="content-placeholder"><p>読み込み中...</p></div>';

    fetch('pages/' + pageId + '.html')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        pageCache[pageId] = html;
        contentBody.innerHTML = html;
        scrollContentTop();
      })
      .catch(function () {
        contentBody.innerHTML =
          '<h1>読み込みエラー</h1>' +
          '<p>ページ <code>' + escapeHtml(pageId) + '.html</code> を読み込めませんでした。</p>' +
          '<p><a href="?page=' + ALL_PAGES[0].id + '">最初のページへ</a></p>';
      });
  }

  function scrollContentTop() {
    var area = qs('.content-area');
    if (area) area.scrollTop = 0;
  }

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
    var section   = SECTIONS.find(function (s) { return s.id === page.section; });
    var bcSection = qs('#breadcrumb-section');
    var bcPage    = qs('#breadcrumb-page');
    var bcSep     = qs('#breadcrumb-sep');
    if (!bcSection || !bcPage || !bcSep) return;

    bcSection.textContent = section ? section.label : page.title;
    bcPage.textContent    = section ? page.title : '';
    bcSep.style.display   = section ? 'inline' : 'none';
  }

  /* ----------------------------------------------------------------
     TOC アクティブリンクの更新
  ---------------------------------------------------------------- */
  function setActiveLink(pageId, sectionId) {
    document.querySelectorAll('.toc-page-link').forEach(function (link) {
      link.classList.remove('active');
    });
    var active = qs('[data-page-id="' + pageId + '"]');
    if (active) {
      active.classList.add('active');
      openSection(sectionId);
    }
  }

  function openSection(sectionId) {
    var btn      = qs('[data-section="' + sectionId + '"]');
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
    var idx      = ALL_PAGES.findIndex(function (p) { return p.id === pageId; });
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
    var overlay   = qs('#sidebar-overlay');
    var hamburger = qs('#hamburger-btn');
    if (overlay)   overlay.style.display = 'block';
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    var overlay   = qs('#sidebar-overlay');
    var hamburger = qs('#hamburger-btn');
    if (overlay)   overlay.style.display = 'none';
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  function initMobileMenu() {
    var hamburger = qs('#hamburger-btn');
    var overlay   = qs('#sidebar-overlay');
    if (hamburger) hamburger.addEventListener('click', function () {
      document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar();
    });
    if (overlay) overlay.addEventListener('click', closeSidebar);
  }

  /* ----------------------------------------------------------------
     ルーター
  ---------------------------------------------------------------- */
  function getPageFromUrl() {
    return new URLSearchParams(window.location.search).get('page') || '';
  }

  function initRouter() {
    window.addEventListener('popstate', function (e) {
      var id = (e.state && e.state.page) || getPageFromUrl();
      loadPage(id || ALL_PAGES[0].id);
    });

    var initial = getPageFromUrl();
    loadPage(initial || ALL_PAGES[0].id);
  }

  /* ----------------------------------------------------------------
     パブリック API（search.js から利用）
  ---------------------------------------------------------------- */
  window.ManualApp = {
    loadPage:    loadPage,
    getAllPages:  function () { return ALL_PAGES; },
    getSections: function () { return SECTIONS; },
    getCache:    function () { return pageCache; }
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
