// games/ghost-runner/game.js
// Ghost Runner: canvas side-scroller + spelling quiz state machine.
// Standalone page — this script starts the game itself on DOMContentLoaded.
// Classic script; depends on shared/utils.js and ui.js having already run.

;(function () {
  const { loadWords, buildChoices } = window.ALUtils
  const {
    buildLayout, bindModeSelect, bindCsvLoader, showPlayScreen,
    updateHUD, showQuiz, hideQuiz, setTimerFill, disableChoices, markChoice,
    showCorrectFeedback, showWrongFeedback, showTimeoutFeedback,
    showGameOver, bindRestart, MODE_TIMES,
  } = window.ALGhostRunnerUI

  const FALLBACK_WORDS = [
    { w: 'วิทยาศาสตร์', b: 'วิทยา...าสตร์', m: 'ศ', h: 'วิชาที่ศึกษาธรรมชาติ', e: 'science', c: 'การันต์ซับซ้อน' },
    { w: 'เกษตร', b: 'เก...ตร', m: 'ษ', h: 'การปลูกพืชเลี้ยงสัตว์', e: 'agriculture', c: 'ตัวสะกดผิดมาตรา' },
    { w: 'คอมพิวเตอร์', b: 'คอม...วเตอร์', m: 'พิ', h: 'เครื่องประมวลผลข้อมูล', e: 'computer', c: 'คำทับศัพท์' },
    { w: 'อยุธยา', b: 'อยุ...ยา', m: 'ธ', h: 'อดีตเมืองหลวงของไทย', e: 'Ayutthaya', c: 'ชื่อเฉพาะ' },
  ]

  // ---- constants (per spec) ----
  const HERO_SX = 300
  const GHOST_HOME = HERO_SX - 190
  const GHOST_EDGE = 30
  const GHOST_HIT = HERO_SX - 60
  const OBS_STOP = HERO_SX + 80
  const GHOST_ATTACK_SX = HERO_SX - 20 // how close the ghost leaps in to attack
  const GHOST_LEAP_FRAMES = 16 // duration of the leap-in attack
  const GHOST_HOP_HEIGHT = 22 // extra upward arc while leaping
  const RUN_SPEED_START = 3.5
  const RUN_SPEED_MAX = 5.5
  const RUN_SPEED_ACCEL = 0.0007
  const GY = 118
  const GRAVITY = 0.85
  const JUMP_VY = -14
  const ANIMALS = ['🐈', '🐖', '🦒', '🦙', '🐓', '🐩', '🐕', '🦔', '🐢']
  const W = 600, H = 160

  const PARTICLE_COLORS = { correct: '#1D9E75', wrong: '#E24B4A', jump: '#EF9F27' }

  function start(container) {
    const refs = buildLayout(container)
    let words = FALLBACK_WORDS

    loadWords('words.csv', FALLBACK_WORDS).then(w => { words = w })
    bindCsvLoader(refs, w => { words = w })

    let running = true
    let rafId = null

    // ---- mutable game state ----
    let mode = 'normal', modeTime = MODE_TIMES.normal
    let state = 'RUN'
    let hearts = 3, score = 0, combo = 0
    let frame = 0
    let bgOff = 0
    let runSpeed = RUN_SPEED_START
    let obsSX = W + 60
    let obsEmoji = randomAnimal()
    let ghostSX = GHOST_HOME
    let ghostHop = 0
    let heroY = GY, heroVy = 0
    let heroHitTimer = 0
    let hitStartGhostSX = GHOST_HIT
    let hitAttackTriggered = false
    let postJumpObs = false
    let blockedAt = 0, ghostStartSX = GHOST_HOME
    let currentWord = null, currentChoices = []
    let timedOut = false
    let particles = []

    function randomAnimal() { return ANIMALS[Math.floor(Math.random() * ANIMALS.length)] }

    function resetState() {
      state = 'RUN'
      hearts = 3; score = 0; combo = 0
      frame = 0; bgOff = 0
      runSpeed = RUN_SPEED_START
      obsSX = W + 60
      obsEmoji = randomAnimal()
      ghostSX = GHOST_HOME
      ghostHop = 0
      heroY = GY; heroVy = 0
      heroHitTimer = 0
      hitAttackTriggered = false
      postJumpObs = false
      particles = []
      updateHUD(refs, { hearts, score, combo })
    }

    function spawnObs() {
      obsSX = W + 40 + Math.random() * 60
      obsEmoji = randomAnimal()
    }

    function pickNextWord() {
      currentWord = words[Math.floor(Math.random() * words.length)]
      currentChoices = buildChoices(currentWord)
    }

    function spawnParticles(kind, x, y) {
      const color = PARTICLE_COLORS[kind]
      for (let i = 0; i < 10; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3 - 1,
          life: 30, color,
        })
      }
    }

    function updateParticles() {
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--
      }
      particles = particles.filter(p => p.life > 0)
    }

    // ---- BLOCKED -> quiz ----
    function onBlocked() {
      state = 'BLOCKED'
      blockedAt = performance.now()
      ghostStartSX = ghostSX
      timedOut = false
      pickNextWord()
      showQuiz(refs, currentWord, currentChoices)
      refs.choicesEl.querySelectorAll('.quiz-choice-btn').forEach(btn => {
        btn.addEventListener('click', () => handleAnswer(btn.dataset.letter), { once: true })
      })
    }

    function handleAnswer(letter) {
      if (state !== 'BLOCKED' || timedOut) return
      disableChoices(refs)
      const correct = letter === currentWord.m
      if (correct) {
        markChoice(refs, letter, 'correct')
        showCorrectFeedback(refs, currentWord.b, letter)
        combo++
        const pts = combo >= 3 ? 30 : combo === 2 ? 20 : 10
        score += pts
        updateHUD(refs, { hearts, score, combo })
        spawnParticles('correct', HERO_SX, GY - 40)
        setTimeout(startJump, 800)
      } else {
        markChoice(refs, letter, 'wrong')
        markChoice(refs, currentWord.m, 'correct')
        showWrongFeedback(refs, currentWord.b, letter, currentWord.m)
        combo = 0
        updateHUD(refs, { hearts, score, combo })
        spawnParticles('wrong', HERO_SX, GY - 40)
        setTimeout(startHit, 1100)
      }
    }

    function triggerTimeout() {
      disableChoices(refs)
      markChoice(refs, currentWord.m, 'correct')
      showTimeoutFeedback(refs, currentWord.b, currentWord.m)
      combo = 0
      updateHUD(refs, { hearts, score, combo })
      setTimeout(startHit, 1100)
    }

    function startJump() {
      state = 'JUMP'
      heroVy = JUMP_VY
      hideQuiz(refs)
      spawnParticles('jump', HERO_SX, GY)
    }

    function startHit() {
      state = 'HIT'
      hearts = Math.max(0, hearts - 1)
      updateHUD(refs, { hearts, score, combo })
      hideQuiz(refs)
      heroHitTimer = 55
      hitStartGhostSX = ghostSX
      hitAttackTriggered = false
    }

    function gameOver() {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      showGameOver(refs, score)
    }

    // ---- drawing ----
    function draw() {
      const c = refs.ctx
      c.clearRect(0, 0, W, H)
      c.fillStyle = '#eef1f8'
      c.fillRect(0, 0, W, H)

      // scrolling ground
      c.strokeStyle = '#c7cee0'
      c.lineWidth = 2
      c.beginPath()
      c.moveTo(0, 140); c.lineTo(W, 140)
      c.stroke()
      c.fillStyle = '#c7cee0'
      const dashW = 26
      const offset = bgOff % dashW
      for (let x = -dashW + (dashW - offset); x < W; x += dashW) {
        c.fillRect(x, 144, 14, 3)
      }

      const bob = Math.sin(frame * 0.28) * 2.5
      const ghostFloat = Math.sin(frame * 0.20) * 4

      // ghost — ghostHop lifts it during the HIT leap-attack
      c.save()
      c.font = '36px sans-serif'
      c.textAlign = 'center'
      c.textBaseline = 'alphabetic'
      c.fillText('👻', ghostSX, 90 + ghostFloat - ghostHop)
      c.restore()

      // danger bar above ghost during BLOCKED
      if (state === 'BLOCKED') {
        const t = Math.min(1, (performance.now() - blockedAt) / (modeTime * 1000))
        const barW = 40
        const bx = ghostSX - barW / 2
        const by = 90 + ghostFloat - 46
        c.fillStyle = '#e1e5ee'
        c.fillRect(bx, by, barW, 6)
        const color = t <= 0.5 ? '#1D9E75' : t <= 0.8 ? '#EF9F27' : '#E24B4A'
        c.fillStyle = color
        c.fillRect(bx, by, barW * t, 6)
      }

      // obstacle — hidden during HIT, the ghost is the one attacking now
      if (state !== 'HIT') {
        c.save()
        c.font = '30px sans-serif'
        c.textAlign = 'center'
        c.fillText(obsEmoji, obsSX, GY + bob)
        c.restore()
      }

      // hero — stays put at HERO_SX; the ghost leaps in to attack it
      let alpha = 1
      if (state === 'HIT') alpha = (Math.floor(frame / 4) % 2 === 0) ? 1 : 0.3
      c.save()
      c.globalAlpha = alpha
      c.font = '46px sans-serif'
      c.textAlign = 'center'
      const heroBob = state === 'JUMP' ? 0 : bob
      c.fillText('🏃‍♂️‍➡️', HERO_SX, heroY + heroBob)
      c.restore()

      // particles
      for (const p of particles) {
        c.save()
        c.globalAlpha = Math.max(0, p.life / 30)
        c.fillStyle = p.color
        c.beginPath()
        c.arc(p.x, p.y, 3, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }

    // ---- main loop ----
    function loop() {
      if (!running) return
      frame++

      runSpeed = Math.min(RUN_SPEED_MAX, runSpeed + RUN_SPEED_ACCEL)

      if (state === 'RUN') {
        bgOff += runSpeed
        obsSX -= runSpeed

        if (postJumpObs) {
          // The just-jumped obstacle is still finishing its job of pushing
          // the ghost back toward GHOST_EDGE. Don't check for a new BLOCKED
          // trigger yet — otherwise this same obstacle (already past the
          // hero, so its x already satisfies obsSX <= OBS_STOP) would
          // instantly re-trigger the quiz before the ghost has been pushed
          // back and a fresh obstacle has had a chance to run in.
          obsSX -= runSpeed * 1.5
          if (obsSX <= ghostSX + 20) ghostSX = Math.max(GHOST_EDGE, obsSX - 20)
          if (ghostSX <= GHOST_EDGE || obsSX < -60) {
            postJumpObs = false
            spawnObs()
          }
        } else if (obsSX <= OBS_STOP) {
          onBlocked()
        }
      } else if (state === 'BLOCKED') {
        const t = Math.min(1, (performance.now() - blockedAt) / (modeTime * 1000))
        ghostSX = ghostStartSX + (GHOST_HIT - ghostStartSX) * t
        setTimerFill(refs, t)
        if (t >= 1 && !timedOut) { timedOut = true; triggerTimeout() }
      } else if (state === 'JUMP') {
        heroVy += GRAVITY
        heroY += heroVy
        bgOff += runSpeed
        obsSX -= runSpeed
        if (obsSX <= ghostSX + 20) ghostSX = Math.max(GHOST_EDGE, obsSX - 20)
        if (heroY >= GY) { heroY = GY; state = 'RUN'; postJumpObs = true }
      } else if (state === 'HIT') {
        // The hero stays put; the ghost leaps in to attack (a quick hop
        // toward the hero), then retreats back home once the attack lands.
        const elapsed = 55 - heroHitTimer
        if (elapsed < GHOST_LEAP_FRAMES) {
          const t = Math.min(1, elapsed / GHOST_LEAP_FRAMES)
          ghostSX = hitStartGhostSX + (GHOST_ATTACK_SX - hitStartGhostSX) * t
          ghostHop = Math.sin(t * Math.PI) * GHOST_HOP_HEIGHT
          if (!hitAttackTriggered && t >= 1) {
            hitAttackTriggered = true
            spawnParticles('wrong', GHOST_ATTACK_SX, GY - 40)
          }
        } else {
          ghostHop = 0
          ghostSX = Math.max(GHOST_HOME, ghostSX - 5) // retreat back home
        }
        heroHitTimer--
        if (heroHitTimer <= 0) {
          if (hearts <= 0) { gameOver(); return }
          state = 'RUN'
          ghostSX = GHOST_HOME
          ghostHop = 0
          spawnObs()
        }
      }

      updateParticles()
      draw()
      rafId = requestAnimationFrame(loop)
    }

    function startGame(chosenMode) {
      mode = chosenMode
      modeTime = MODE_TIMES[mode] || MODE_TIMES.normal
      resetState()
      showPlayScreen(refs)
      running = true
      loop()
    }

    bindModeSelect(refs, startGame)
    bindRestart(refs, () => {
      refs.gameover.hidden = true
      refs.setup.hidden = false
    })
  }

  document.addEventListener('DOMContentLoaded', () => {
    start(document.getElementById('game-root'))
  })
})()
