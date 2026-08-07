// shared/utils.js
// Shared helpers used by the hub and every game page.
// Plain classic script (no ES modules) so everything works when the
// files are opened directly by double-clicking index.html (file:// URLs
// block ES module loading and fetch() with CORS errors) as well as when
// served over http.
//
// Exposes everything on the global `ALUtils` namespace.

;(function () {

  // ---------------------------------------------------------------
  // CSV parsing
  // ---------------------------------------------------------------
  function parseCSV(text) {
    const lines = text.trim().split('\n')
    return lines.slice(1) // skip header
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // handle quoted fields (fields containing commas)
        const cols = []
        let cur = '', inQuote = false
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote }
          else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = '' }
          else cur += ch
        }
        cols.push(cur.trim())
        if (cols.length < 6) return null
        return { w: cols[0], b: cols[1], m: cols[2], h: cols[3], e: cols[4], c: cols[5] }
      })
      .filter(Boolean)
  }

  // Load a game's words.csv with graceful fallback.
  //   1. fetch() the CSV next to the page (works when served over http/https)
  //   2. if that fails (e.g. opened via file:// where fetch is blocked by
  //      CORS), fall back to the page's embedded `window.AL_WORD_DATA`
  //      (set by that game's words-data.js — the same content as the CSV)
  //   3. if that's missing too, fall back to the small built-in word list
  //      the game module ships with.
  function loadWords(csvPath, fallbackWords) {
    const embeddedOrFallback = () =>
      (window.AL_WORD_DATA && window.AL_WORD_DATA.length > 0) ? window.AL_WORD_DATA : fallbackWords

    // fetch() of local files always fails under file:// (blocked by CORS) —
    // skip straight to the embedded copy instead of letting the browser log
    // a scary (but harmless) network error to the console every time.
    if (location.protocol === 'file:') {
      return Promise.resolve(embeddedOrFallback())
    }

    return fetch(csvPath)
      .then(r => {
        if (!r.ok) throw new Error('fetch failed')
        return r.text()
      })
      .then(text => {
        const words = parseCSV(text)
        return words.length > 0 ? words : embeddedOrFallback()
      })
      .catch(embeddedOrFallback)
  }

  // Wire up a <input type="file" accept=".csv"> element to load a word list.
  function bindCsvUpload(inputEl, onWords) {
    if (!inputEl) return
    inputEl.addEventListener('change', e => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = ev => {
        const words = parseCSV(ev.target.result)
        if (words.length > 0) {
          onWords(words)
          showToast(`Loaded ${words.length} words ✓`)
        } else {
          showToast('Invalid file. Please check the CSV format.')
        }
      }
      reader.readAsText(file, 'UTF-8')
      inputEl.value = '' // allow re-selecting the same file later
    })
  }

  // ---------------------------------------------------------------
  // Answer helpers
  // ---------------------------------------------------------------
  function fillBlank(blank, chosen) {
    return blank.replace('...', chosen)
  }

  // ---------------------------------------------------------------
  // Wrong-answer pools & category colors (shared by all games)
  // ---------------------------------------------------------------
  const WRONG_POOLS = {
    'การันต์ซับซ้อน': ['ษ', 'ศ', 'ส', 'น', 'ร', 'ว', 'ข', 'ภ', 'พ', 'จ', 'ล', 'ณ'],
    'ตัวสะกดผิดมาตรา': ['ก', 'ษ', 'ศ', 'ส', 'น', 'ร', 'เก', 'เศ', 'ช', 'ณ', 'ท', 'ทร'],
    'คำทับศัพท์': ['พ', 'ต', 'น', 'ค', 'เต', 'เล', 'เท', 'ล', 'ม', 'ว', 'ช', 'ร'],
    'ชื่อเฉพาะ': ['ม', 'ภ', 'ใ', 'ธ', 'ณ', 'น', 'ร', 'ส', 'ว', 'ข', 'ล', 'ย'],
  }

  const CATEGORY_COLORS = {
    'การันต์ซับซ้อน': { bg: '--bg-accent', text: '--text-accent' },
    'ตัวสะกดผิดมาตรา': { bg: '--bg-warning', text: '--text-warning' },
    'คำทับศัพท์': { bg: '--bg-success', text: '--text-success' },
    'ชื่อเฉพาะ': { bg: '--bg-danger', text: '--text-danger' },
  }

  function categoryColors(category) {
    return CATEGORY_COLORS[category] || { bg: '--bg-accent', text: '--text-accent' }
  }

  function shuffle(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // Build 4 answer choices (1 correct + 3 wrong) from the category pool.
  function buildChoices(word) {
    const pool = (WRONG_POOLS[word.c] || []).filter(x => x !== word.m)
    const wrong = shuffle(pool).slice(0, 3)
    const fallbackPool = ['ก', 'ข', 'ค', 'ง', 'จ', 'ช', 'ด', 'ต', 'บ', 'ป'].filter(x => x !== word.m && !wrong.includes(x))
    while (wrong.length < 3 && fallbackPool.length) {
      wrong.push(fallbackPool.shift())
    }
    return shuffle([word.m, ...wrong])
  }

  // ---------------------------------------------------------------
  // Toast notifications
  // ---------------------------------------------------------------
  let toastTimer = null
  function showToast(message) {
    let el = document.getElementById('toast')
    if (!el) {
      el = document.createElement('div')
      el.id = 'toast'
      el.className = 'toast'
      document.body.appendChild(el)
    }
    el.textContent = message
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000)
  }

  window.ALUtils = {
    parseCSV, loadWords, bindCsvUpload, fillBlank,
    WRONG_POOLS, CATEGORY_COLORS, categoryColors, shuffle, buildChoices, showToast,
  }
})()
