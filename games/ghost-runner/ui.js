// games/ghost-runner/ui.js
// DOM chrome for Ghost Runner: mode-select screen, HUD, quiz panel,
// answer feedback and game-over screen. game.js owns the canvas +
// state machine and drives these functions each frame / on events.
// Classic script (no ES modules) — depends on shared/utils.js having
// already run and exposed `window.ALUtils`.

;(function () {
  const { categoryColors, fillBlank, bindCsvUpload } = window.ALUtils

  const MODE_TIMES = { easy: 12, normal: 8, hard: 5 }

  function buildLayout(container) {
    container.innerHTML = `
      <div class="gr-wrap">
        <div class="game-title-row">👻 Ghost Runner</div>

        <div id="gr-setup" class="gr-setup">
          <p class="gr-setup-label">Choose difficulty:</p>
          <div class="gr-mode-row">
            <button class="gr-mode-btn" data-mode="easy">Easy<span>12s</span></button>
            <button class="gr-mode-btn" data-mode="normal">Normal<span>8s</span></button>
            <button class="gr-mode-btn" data-mode="hard">Hard<span>5s</span></button>
          </div>
          <div class="csv-upload-wrap">
            <label class="csv-upload-label">
              📂 Load word list
              <input type="file" id="gr-csv-upload" accept=".csv">
            </label>
          </div>
        </div>

        <div id="gr-play" class="gr-play" hidden>
          <div class="gr-hud">
            <div id="gr-hearts" class="gr-hearts"></div>
            <div id="gr-score" class="gr-score">Score: 0</div>
            <div id="gr-combo" class="gr-combo"></div>
          </div>

          <canvas id="gr-canvas" width="600" height="160"></canvas>

          <div id="gr-quiz" class="quiz-panel" hidden>
            <div class="quiz-timerbar"><div id="gr-timerfill" class="quiz-timerbar-fill"></div></div>
            <div id="gr-catbadge" class="cat-badge"></div>
            <div id="gr-word" class="quiz-word"></div>
            <div id="gr-hint" class="quiz-hint"></div>
            <div id="gr-choices" class="quiz-choices"></div>
            <div id="gr-resultarea" class="quiz-result-area"></div>
          </div>
        </div>

        <div id="gr-gameover" class="gr-gameover" hidden>
          <h2>Game Over</h2>
          <p id="gr-final-score"></p>
          <button id="gr-restart" class="play-btn">Play Again</button>
        </div>
      </div>
    `

    const refs = {
      setup: container.querySelector('#gr-setup'),
      play: container.querySelector('#gr-play'),
      canvas: container.querySelector('#gr-canvas'),
      heartsEl: container.querySelector('#gr-hearts'),
      scoreEl: container.querySelector('#gr-score'),
      comboEl: container.querySelector('#gr-combo'),
      quiz: container.querySelector('#gr-quiz'),
      timerFill: container.querySelector('#gr-timerfill'),
      catBadge: container.querySelector('#gr-catbadge'),
      wordEl: container.querySelector('#gr-word'),
      hintEl: container.querySelector('#gr-hint'),
      choicesEl: container.querySelector('#gr-choices'),
      resultArea: container.querySelector('#gr-resultarea'),
      gameover: container.querySelector('#gr-gameover'),
      finalScore: container.querySelector('#gr-final-score'),
      restartBtn: container.querySelector('#gr-restart'),
      csvUpload: container.querySelector('#gr-csv-upload'),
    }
    refs.ctx = refs.canvas.getContext('2d')
    return refs
  }

  function bindModeSelect(refs, onPick) {
    refs.setup.querySelectorAll('.gr-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => onPick(btn.dataset.mode))
    })
  }

  function bindCsvLoader(refs, onWords) {
    bindCsvUpload(refs.csvUpload, onWords)
  }

  function showPlayScreen(refs) {
    refs.setup.hidden = true
    refs.play.hidden = false
  }

  function updateHUD(refs, { hearts, score, combo }) {
    refs.heartsEl.textContent = '❤️'.repeat(Math.max(0, hearts)) + '🖤'.repeat(Math.max(0, 3 - hearts))
    refs.scoreEl.textContent = `Score: ${score}`
    refs.comboEl.textContent = combo > 1 ? `Combo x${combo}` : ''
  }

  function showQuiz(refs, word, choices) {
    refs.resultArea.innerHTML = ''
    refs.choicesEl.innerHTML = ''
    const colors = categoryColors(word.c)
    refs.catBadge.textContent = word.c
    refs.catBadge.style.background = `var(${colors.bg})`
    refs.catBadge.style.color = `var(${colors.text})`
    refs.wordEl.textContent = word.b
    refs.hintEl.innerHTML = `${word.h} <span class="hint-en">(${word.e})</span>`

    choices.forEach(letter => {
      const btn = document.createElement('button')
      btn.className = 'quiz-choice-btn'
      btn.textContent = letter
      btn.dataset.letter = letter
      refs.choicesEl.appendChild(btn)
    })

    refs.quiz.hidden = false
  }

  function hideQuiz(refs) {
    refs.quiz.hidden = true
  }

  function setTimerFill(refs, t) {
    const pct = Math.max(0, 1 - t) * 100
    refs.timerFill.style.width = pct + '%'
    refs.timerFill.classList.toggle('warn', t > 0.5 && t <= 0.8)
    refs.timerFill.classList.toggle('danger', t > 0.8)
  }

  function disableChoices(refs) {
    refs.choicesEl.querySelectorAll('.quiz-choice-btn').forEach(b => b.disabled = true)
  }

  function markChoice(refs, letter, cls) {
    const btn = refs.choicesEl.querySelector(`[data-letter="${CSS.escape(letter)}"]`)
    if (btn) btn.classList.add(cls)
  }

  function showCorrectFeedback(refs, blank, chosen) {
    refs.resultArea.innerHTML = `<span class="word-result correct">${fillBlank(blank, chosen)}</span>`
  }

  function showWrongFeedback(refs, blank, chosen, missing) {
    refs.resultArea.innerHTML = `
      <span class="word-result wrong">${fillBlank(blank, chosen)}</span><br>
      <span class="word-result correct">${fillBlank(blank, missing)}</span>
    `
  }

  function showTimeoutFeedback(refs, blank, missing) {
    refs.resultArea.innerHTML = `
      <span class="word-timeout">Time's up!</span>
      <span class="word-result correct">${fillBlank(blank, missing)}</span>
    `
  }

  function showGameOver(refs, score) {
    refs.play.hidden = true
    refs.gameover.hidden = false
    refs.finalScore.textContent = `Final Score: ${score}`
  }

  function bindRestart(refs, onRestart) {
    refs.restartBtn.addEventListener('click', onRestart)
  }

  window.ALGhostRunnerUI = {
    MODE_TIMES, buildLayout, bindModeSelect, bindCsvLoader, showPlayScreen,
    updateHUD, showQuiz, hideQuiz, setTimerFill, disableChoices, markChoice,
    showCorrectFeedback, showWrongFeedback, showTimeoutFeedback,
    showGameOver, bindRestart,
  }
})()
