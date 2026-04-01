/**
 * search.js
 * クライアントサイド全文検索
 *
 * 依存:
 *   - content.js  (MANUAL_CONTENT)
 *   - app.js      (ManualApp.loadPage, ManualApp.getAllPages, ManualApp.getSections)
 */

;(function () {
  'use strict';

  /* ----------------------------------------------------------------
     検索インデックス（初回ビルド後はキャッシュ）
  ---------------------------------------------------------------- */
  var searchIndex = null;

  /**
   * HTML タグを除去してプレーンテキストに変換
   * @param {string} html
   * @returns {string}
   */
  function stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 検索インデックスを構築する（遅延ビルド）
   * @returns {Array<{id, title, sectionLabel, text}>}
   */
  function buildIndex() {
    if (searchIndex) return searchIndex;
    var sections = ManualApp.getSections();
    var sectionMap = {};
    sections.forEach(function (s) { sectionMap[s.id] = s.label; });

    searchIndex = MANUAL_CONTENT.map(function (page) {
      return {
        id:           page.id,
        title:        page.title,
        sectionLabel: sectionMap[page.section] || '',
        text:         stripHtml(page.content).toLowerCase()
      };
    });
    return searchIndex;
  }

  /* ----------------------------------------------------------------
     スコアリング検索
  ---------------------------------------------------------------- */
  /**
   * クエリ文字列でページを検索し、スコア順に返す
   * @param {string} query
   * @returns {Array<{page, score, snippet}>}
   */
  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) return [];

    var tokens = q.split(/\s+/).filter(Boolean);
    var index = buildIndex();
    var results = [];

    index.forEach(function (entry) {
      var titleLower = entry.title.toLowerCase();
      var score = 0;

      tokens.forEach(function (token) {
        // タイトル完全一致
        if (titleLower === token)               score += 10;
        // タイトル前方一致
        else if (titleLower.startsWith(token))  score += 7;
        // タイトル部分一致
        else if (titleLower.includes(token))    score += 5;

        // 本文出現回数（1回につき+1、最大10）
        var bodyCount = 0;
        var pos = 0;
        while ((pos = entry.text.indexOf(token, pos)) !== -1) {
          bodyCount++;
          pos += token.length;
          if (bodyCount >= 10) break;
        }
        score += bodyCount;
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

    return results
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 10);
  }

  /**
   * 本文から検索語を含むスニペットを生成（~100文字）
   * @param {string} text プレーンテキスト（小文字）
   * @param {string[]} tokens
   * @returns {string} HTML（<mark> タグ付き）
   */
  function makeSnippet(text, tokens) {
    var SNIPPET_LEN = 100;
    var bestPos = -1;

    // 最初にヒットしたトークンの位置を探す
    tokens.forEach(function (token) {
      var pos = text.indexOf(token);
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
        bestPos = pos;
      }
    });

    if (bestPos === -1) return '';

    var start = Math.max(0, bestPos - 20);
    var end   = Math.min(text.length, start + SNIPPET_LEN);
    var snippet = (start > 0 ? '…' : '') +
                  text.slice(start, end) +
                  (end < text.length ? '…' : '');

    // マッチ箇所に <mark> を付与
    tokens.forEach(function (token) {
      var regex = new RegExp('(' + escapeRegex(token) + ')', 'gi');
      snippet = snippet.replace(regex, '<mark>$1</mark>');
    });

    return snippet;
  }

  /** RegExp 用エスケープ */
  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* ----------------------------------------------------------------
     UI の更新
  ---------------------------------------------------------------- */
  var resultsEl = null;

  /**
   * 検索結果ドロップダウンを描画する
   * @param {Array} results
   * @param {string} query
   */
  function renderResults(results, query) {
    if (!resultsEl) return;

    if (!query.trim()) {
      closeResults();
      return;
    }

    resultsEl.innerHTML = '';
    resultsEl.classList.add('open');

    if (results.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = '"' + query + '" に一致するページが見つかりませんでした。';
      resultsEl.appendChild(empty);
      return;
    }

    var focusedIdx = -1;

    results.forEach(function (result, idx) {
      var item = document.createElement('div');
      item.className = 'search-result-item';
      item.setAttribute('role', 'option');
      item.setAttribute('tabindex', '-1');
      item.setAttribute('data-idx', idx);

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
        snippetEl.innerHTML = result.snippet;  // <mark> を含む
        item.appendChild(snippetEl);
      }

      item.addEventListener('mousedown', function (e) {
        // mousedown でフォーカスが外れてドロップダウンが閉じないように
        e.preventDefault();
      });

      item.addEventListener('click', function () {
        ManualApp.loadPage(result.id);
        closeResults();
        var input = document.querySelector('#search-input');
        if (input) { input.value = ''; input.blur(); }
      });

      resultsEl.appendChild(item);
    });

    // キーボード操作のため items を返す
    return resultsEl.querySelectorAll('.search-result-item');
  }

  function closeResults() {
    if (resultsEl) {
      resultsEl.classList.remove('open');
      resultsEl.innerHTML = '';
    }
  }

  /* ----------------------------------------------------------------
     デバウンス
  ---------------------------------------------------------------- */
  function debounce(fn, delay) {
    var timer;
    return function () {
      clearTimeout(timer);
      var args = arguments;
      var ctx  = this;
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

    // インデックスをアイドル時間に先読み
    if (window.requestIdleCallback) {
      requestIdleCallback(function () { buildIndex(); });
    } else {
      setTimeout(function () { buildIndex(); }, 500);
    }

    var currentItems = null;
    var focusedIdx   = -1;

    var doSearch = debounce(function (query) {
      var results = search(query);
      currentItems = renderResults(results, query);
      focusedIdx = -1;
    }, 150);

    // 入力イベント
    input.addEventListener('input', function () {
      doSearch(input.value);
    });

    // フォーカス時: 入力値があれば再表示
    input.addEventListener('focus', function () {
      if (input.value.trim()) {
        doSearch(input.value);
      }
    });

    // キーボードナビゲーション
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
        if (focusedIdx >= 0 && items[focusedIdx]) {
          items[focusedIdx].click();
        }

      } else if (e.key === 'Escape') {
        closeResults();
        input.blur();
      }
    });

    // 外側クリックで閉じる
    document.addEventListener('click', function (e) {
      var wrapper = document.querySelector('.search-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        closeResults();
      }
    });
  }

  /**
   * キーボードフォーカスの視覚更新
   */
  function updateFocus(items, idx) {
    items.forEach(function (item, i) {
      item.classList.toggle('focused', i === idx);
    });
    if (items[idx]) {
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  /* ----------------------------------------------------------------
     初期化
  ---------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initSearch();
  });

})();
