/**
 * search.js
 * クライアントサイド全文検索
 *
 * 各ページの HTML ファイルを fetch() して検索インデックスを構築します。
 * 依存:
 *   - content.js  (MANUAL_CONTENT)
 *   - app.js      (ManualApp.loadPage, ManualApp.getAllPages,
 *                  ManualApp.getSections, ManualApp.getCache)
 */

;(function () {
  'use strict';

  /* ----------------------------------------------------------------
     検索インデックス
  ---------------------------------------------------------------- */
  var searchIndex  = null;   // 構築後: Array<{id, title, sectionLabel, text}>
  var indexReady   = false;
  var indexPending = false;

  /** HTML タグを除去してプレーンテキストに変換 */
  function stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g,  '&')
      .replace(/&lt;/g,   '<')
      .replace(/&gt;/g,   '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g,  "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g,    ' ')
      .trim();
  }

  /**
   * 全ページを並列 fetch してインデックスを構築する。
   * キャッシュ済みの HTML（ManualApp.getCache()）があれば再利用。
   */
  function buildIndex() {
    if (indexReady || indexPending) return;
    indexPending = true;

    var sections  = ManualApp.getSections();
    var sectionMap = {};
    sections.forEach(function (s) { sectionMap[s.id] = s.label; });

    var pages = ManualApp.getAllPages();
    var cache = ManualApp.getCache();

    var fetchAll = pages.map(function (page) {
      // キャッシュ済みならそのまま使用
      if (cache[page.id]) {
        return Promise.resolve({ id: page.id, html: cache[page.id] });
      }
      return fetch('pages/' + page.id + '.html')
        .then(function (res) {
          return res.ok ? res.text() : '';
        })
        .then(function (html) {
          return { id: page.id, html: html };
        })
        .catch(function () {
          return { id: page.id, html: '' };
        });
    });

    Promise.all(fetchAll).then(function (results) {
      searchIndex = results.map(function (r) {
        var page = pages.find(function (p) { return p.id === r.id; });
        return {
          id:           r.id,
          title:        page ? page.title : r.id,
          sectionLabel: page ? (sectionMap[page.section] || '') : '',
          text:         stripHtml(r.html).toLowerCase()
        };
      });
      indexReady = true;
    });
  }

  /* ----------------------------------------------------------------
     スコアリング検索
  ---------------------------------------------------------------- */
  /**
   * @param {string} query
   * @returns {Array<{id, title, sectionLabel, score, snippet}>}
   */
  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q || !indexReady) return [];

    var tokens = q.split(/\s+/).filter(Boolean);
    var results = [];

    searchIndex.forEach(function (entry) {
      var titleLower = entry.title.toLowerCase();
      var score = 0;

      tokens.forEach(function (token) {
        if (titleLower === token)              score += 10;
        else if (titleLower.startsWith(token)) score += 7;
        else if (titleLower.includes(token))   score += 5;

        var count = 0, pos = 0;
        while ((pos = entry.text.indexOf(token, pos)) !== -1) {
          count++;
          pos += token.length;
          if (count >= 10) break;
        }
        score += count;
      });

      if (score > 0) {
        results.push({
          id:           entry.id,
          title:        entry.title,
          sectionLabel: entry.sectionLabel,
          score:        score,
          snippet:      makeSnippet(entry.text, tokens)
        });
      }
    });

    return results.sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
  }

  /**
   * マッチ箇所周辺のスニペットを生成（~100文字、<mark> タグ付き）
   */
  function makeSnippet(text, tokens) {
    var SNIPPET_LEN = 100;
    var bestPos = -1;
    tokens.forEach(function (token) {
      var pos = text.indexOf(token);
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) bestPos = pos;
    });
    if (bestPos === -1) return '';

    var start   = Math.max(0, bestPos - 20);
    var end     = Math.min(text.length, start + SNIPPET_LEN);
    var snippet = (start > 0 ? '…' : '') +
                  text.slice(start, end) +
                  (end < text.length ? '…' : '');

    tokens.forEach(function (token) {
      var regex = new RegExp('(' + escapeRegex(token) + ')', 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    });
    return snippet;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ----------------------------------------------------------------
     UI の更新
  ---------------------------------------------------------------- */
  var resultsEl = null;
  var focusedIdx = -1;

  function renderResults(results, query) {
    if (!resultsEl) return;
    if (!query.trim()) { closeResults(); return; }

    resultsEl.innerHTML = '';
    resultsEl.classList.add('open');

    if (!indexReady) {
      var loading = document.createElement('div');
      loading.className = 'search-empty';
      loading.textContent = '検索インデックスを準備中です...';
      resultsEl.appendChild(loading);
      return;
    }

    if (results.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = '"' + query + '" に一致するページが見つかりませんでした。';
      resultsEl.appendChild(empty);
      return;
    }

    focusedIdx = -1;
    results.forEach(function (result) {
      var item = document.createElement('div');
      item.className = 'search-result-item';
      item.setAttribute('role', 'option');

      var titleEl = document.createElement('div');
      titleEl.className = 'search-result-title';
      titleEl.textContent = result.title;

      var secEl = document.createElement('div');
      secEl.className = 'search-result-section';
      secEl.textContent = result.sectionLabel;

      item.appendChild(titleEl);
      item.appendChild(secEl);

      if (result.snippet) {
        var snippetEl = document.createElement('div');
        snippetEl.className = 'search-result-snippet';
        snippetEl.innerHTML = result.snippet;
        item.appendChild(snippetEl);
      }

      item.addEventListener('mousedown', function (e) { e.preventDefault(); });
      item.addEventListener('click', function () {
        ManualApp.loadPage(result.id);
        closeResults();
        var input = document.querySelector('#search-input');
        if (input) { input.value = ''; input.blur(); }
      });

      resultsEl.appendChild(item);
    });
  }

  function closeResults() {
    if (resultsEl) {
      resultsEl.classList.remove('open');
      resultsEl.innerHTML = '';
    }
    focusedIdx = -1;
  }

  function updateFocus(items, idx) {
    items.forEach(function (item, i) {
      item.classList.toggle('focused', i === idx);
    });
    if (items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  /* ----------------------------------------------------------------
     デバウンス
  ---------------------------------------------------------------- */
  function debounce(fn, delay) {
    var timer;
    return function () {
      clearTimeout(timer);
      var args = arguments, ctx = this;
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  /* ----------------------------------------------------------------
     イベント初期化
  ---------------------------------------------------------------- */
  function initSearch() {
    var input = document.querySelector('#search-input');
    resultsEl = document.querySelector('#search-results');
    if (!input || !resultsEl) return;

    var doSearch = debounce(function (query) {
      var results = search(query);
      renderResults(results, query);
    }, 150);

    input.addEventListener('input', function () { doSearch(input.value); });

    input.addEventListener('focus', function () {
      if (input.value.trim()) doSearch(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (!resultsEl.classList.contains('open')) return;
      var items = resultsEl.querySelectorAll('.search-result-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIdx = (focusedIdx + 1) % items.length;
        updateFocus(items, focusedIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdx = (focusedIdx - 1 + items.length) % items.length;
        updateFocus(items, focusedIdx);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedIdx >= 0 && items[focusedIdx]) items[focusedIdx].click();
      } else if (e.key === 'Escape') {
        closeResults();
        input.blur();
      }
    });

    document.addEventListener('click', function (e) {
      var wrapper = document.querySelector('.search-wrapper');
      if (wrapper && !wrapper.contains(e.target)) closeResults();
    });
  }

  /* ----------------------------------------------------------------
     初期化
  ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initSearch();
    // アイドル時間に検索インデックスを先読み
    if (window.requestIdleCallback) {
      requestIdleCallback(function () { buildIndex(); }, { timeout: 3000 });
    } else {
      setTimeout(function () { buildIndex(); }, 1000);
    }
  });

})();
