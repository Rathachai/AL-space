// games/clinic/game.js
// Word Clinic: card-based "diagnose the sick word" game with a
// 3-box (Leitner) spaced-repetition system persisted in localStorage.
// Standalone page — this script starts the game itself on DOMContentLoaded.
// Classic script; depends on shared/utils.js having already run.

;(function () {
  const { loadWords, buildChoices, fillBlank, categoryColors, bindCsvUpload } = window.ALUtils

  const FALLBACK_WORDS = [
    { w: 'กบ', b: 'ก...', m: 'บ', h: 'สัตว์สะเทินน้ำสะเทินบก ร้องอ๊บๆ', e: 'frog', c: 'ตัวสะกดผิดมาตรา' },
    { w: 'แมว', b: 'แม...', m: 'ว', h: 'สัตว์เลี้ยงร้องเหมียว', e: 'cat', c: 'ตัวสะกดผิดมาตรา' },
    { w: 'ปลา', b: 'ป...า', m: 'ล', h: 'สัตว์น้ำมีเกล็ด', e: 'fish', c: 'การันต์ซับซ้อน' },
    { w: 'บ้าน', b: 'บ้...', m: 'าน', h: 'ที่อยู่อาศัย', e: 'house', c: 'การันต์ซับซ้อน' },
  ]

  const STORAGE_KEY = 'al-word-clinic-progress-v1'
  const BOX_INTERVAL_DAYS = { 1: 1, 2: 3 } // box 3 = mastered, no more reviews

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
    } catch { return {} }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* ignore quota errors */ }
  }
  function todayISO() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }
  function addDaysISO(days) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function start(container) {
    let words = FALLBACK_WORDS
    loadWords('words.csv', FALLBACK_WORDS).then(w => { words = w; if (queue === null) buildQueueAndRender() })

    container.innerHTML = `
      <div class="wc-wrap">
        <div class="game-title-row">🏥 Word Clinic</div>

        <div class="csv-upload-wrap">
          <label class="csv-upload-label">
            📂 Load word list
            <input type="file" id="wc-csv-upload" accept=".csv">
          </label>
        </div>

        <div class="wc-progress-wrap">
          <div class="wc-progress-label">
            <span id="wc-progress-text">Cured 0 / 0</span>
          </div>
          <div class="wc-progress-bar"><div id="wc-progress-fill" class="wc-progress-fill" style="width:0%"></div></div>
        </div>

        <div id="wc-card" class="wc-card" hidden>
          <div id="wc-catbadge" class="cat-badge"></div>
          <div id="wc-word" class="quiz-word"></div>
          <div id="wc-hint" class="quiz-hint"></div>
          <div id="wc-choices" class="quiz-choices"></div>
          <div id="wc-resultarea" class="quiz-result-area"></div>
          <div id="wc-boxlabel" class="wc-box-label"></div>
        </div>

        <div id="wc-done" class="wc-done" hidden>
          <h2 id="wc-done-title">🎉 All caught up!</h2>
          <p id="wc-done-msg"></p>
        </div>
      </div>
    `

    const els = {
      csvUpload: container.querySelector('#wc-csv-upload'),
      progressText: container.querySelector('#wc-progress-text'),
      progressFill: container.querySelector('#wc-progress-fill'),
      card: container.querySelector('#wc-card'),
      catBadge: container.querySelector('#wc-catbadge'),
      word: container.querySelector('#wc-word'),
      hint: container.querySelector('#wc-hint'),
      choices: container.querySelector('#wc-choices'),
      resultArea: container.querySelector('#wc-resultarea'),
      boxLabel: container.querySelector('#wc-boxlabel'),
      done: container.querySelector('#wc-done'),
      doneTitle: container.querySelector('#wc-done-title'),
      doneMsg: container.querySelector('#wc-done-msg'),
    }

    bindCsvUpload(els.csvUpload, w => { words = w; buildQueueAndRender() })

    let progress = loadProgress()
    let queue = null
    let sessionTotal = 0
    let curedCount = 0
    let current = null
    let answered = false

    function buildQueueAndRender() {
      const today = todayISO()
      queue = words.filter(w => {
        const rec = progress[w.w]
        if (!rec) return true // never seen -> due now
        if (rec.box >= 3) return false // mastered
        return rec.nextReview <= today
      })
      // shuffle
      for (let i = queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[queue[i], queue[j]] = [queue[j], queue[i]]
      }
      sessionTotal = queue.length
      curedCount = 0
      updateProgressUI()
      nextCard()
    }

    function updateProgressUI() {
      els.progressText.textContent = `Cured ${curedCount} / ${sessionTotal}`
      const pct = sessionTotal ? (curedCount / sessionTotal) * 100 : 0
      els.progressFill.style.width = pct + '%'
    }

    function nextCard() {
      if (!queue.length) {
        els.card.hidden = true
        els.done.hidden = false
        const allMastered = words.length > 0 && words.every(w => progress[w.w] && progress[w.w].box >= 3)
        if (sessionTotal === 0 && allMastered) {
          els.doneTitle.textContent = '🏆 All words mastered!'
          els.doneMsg.textContent = `You've cured every word in this list. Amazing work!`
        } else if (sessionTotal === 0) {
          els.doneTitle.textContent = '✅ All caught up!'
          els.doneMsg.textContent = `No words are due today. Come back tomorrow for more practice.`
        } else {
          els.doneTitle.textContent = '🎉 Session complete!'
          els.doneMsg.textContent = `Cured ${curedCount} / ${sessionTotal} words today. See you tomorrow!`
        }
        return
      }
      current = queue.shift()
      answered = false
      els.done.hidden = true
      els.card.hidden = false
      els.card.classList.remove('cured', 'sick')
      els.resultArea.innerHTML = ''
      els.boxLabel.textContent = ''

      const colors = categoryColors(current.c)
      els.catBadge.textContent = current.c
      els.catBadge.style.background = `var(${colors.bg})`
      els.catBadge.style.color = `var(${colors.text})`
      els.word.textContent = current.b
      els.hint.innerHTML = `${current.h} <span class="hint-en">(${current.e})</span>`

      const choices = buildChoices(current)
      els.choices.innerHTML = ''
      choices.forEach(letter => {
        const btn = document.createElement('button')
        btn.className = 'quiz-choice-btn'
        btn.textContent = letter
        btn.addEventListener('click', () => handleChoice(letter, btn), { once: true })
        els.choices.appendChild(btn)
      })
    }

    function handleChoice(letter, btnEl) {
      if (answered) return
      answered = true
      els.choices.querySelectorAll('.quiz-choice-btn').forEach(b => b.disabled = true)

      const rec = progress[current.w] || { box: 0 }
      const correct = letter === current.m

      if (correct) {
        btnEl.classList.add('correct')
        els.resultArea.innerHTML = `<span class="word-result correct">${fillBlank(current.b, letter)}</span>`
        els.card.classList.add('cured')
        const stamp = document.createElement('div')
        stamp.className = 'wc-stamp cured-text'
        stamp.textContent = '✓ Cured!'
        els.card.insertBefore(stamp, els.card.firstChild)

        const newBox = Math.min(3, (rec.box || 0) + 1)
        progress[current.w] = newBox >= 3
          ? { box: 3, nextReview: null }
          : { box: newBox, nextReview: addDaysISO(BOX_INTERVAL_DAYS[newBox]) }
        els.boxLabel.textContent = newBox >= 3
          ? 'Mastered! 🏆'
          : newBox === 1 ? 'Box 1 · see again tomorrow' : 'Box 2 · see again in 3 days'

        curedCount++
      } else {
        btnEl.classList.add('wrong')
        els.choices.querySelectorAll('.quiz-choice-btn').forEach(b => {
          if (b.textContent === current.m) b.classList.add('correct')
        })
        els.resultArea.innerHTML = `
          <span class="word-result wrong">${fillBlank(current.b, letter)}</span><br>
          <span class="word-result correct">${fillBlank(current.b, current.m)}</span>
        `
        els.card.classList.add('sick')
        const stamp = document.createElement('div')
        stamp.className = 'wc-stamp sick-text'
        stamp.textContent = '✗ Needs more practice'
        els.card.insertBefore(stamp, els.card.firstChild)

        progress[current.w] = { box: 1, nextReview: addDaysISO(BOX_INTERVAL_DAYS[1]) }
        els.boxLabel.textContent = 'Box 1 · see again tomorrow'
      }

      saveProgress(progress)
      updateProgressUI()
      setTimeout(nextCard, 1400)
    }

    buildQueueAndRender()
  }

  document.addEventListener('DOMContentLoaded', () => {
    start(document.getElementById('game-root'))
  })
})()
