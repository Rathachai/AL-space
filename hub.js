// hub.js — renders the game hub. Each game is its own standalone HTML
// page (games/<id>/index.html); "Play" is a plain link, so everything
// works when opened by double-clicking index.html (no server needed).
//
// To add a new game: add one object to GAMES + create games/<id>/index.html.
// No other code changes are needed.

;(function () {
  const GAMES = [
    {
      id: 'ghost-runner',
      title: 'Ghost Runner',
      icon: '👻',
      desc: 'Run from the ghost! Spell the missing letter before time runs out.',
      badge: 'Grade 4–6',
      url: 'games/ghost-runner/index.html',
    },
    {
      id: 'clinic',
      title: 'Word Clinic',
      icon: '🏥',
      desc: 'Diagnose sick words. Pick the missing letter to cure them.',
      badge: 'Grade 1–3',
      url: 'games/clinic/index.html',
    },
    {
      id: 'coming-soon',
      title: 'Coming Soon',
      icon: '✨',
      desc: 'A brand new game is on its way. Stay tuned!',
      badge: '—',
      disabled: true,
    },
  ]

  const grid = document.getElementById('game-grid')

  function renderGrid() {
    grid.innerHTML = ''
    for (const game of GAMES) {
      const card = document.createElement('article')
      card.className = 'game-card' + (game.disabled ? ' disabled' : '')

      const playControl = game.disabled
        ? `<button class="play-btn" disabled>Coming Soon</button>`
        : `<a class="play-btn" href="${game.url}">Play</a>`

      card.innerHTML = `
        <div class="game-card-icon">${game.icon}</div>
        <h2 class="game-card-title">${game.title}</h2>
        <p class="game-card-desc">${game.desc}</p>
        <div class="game-card-footer">
          <span class="badge">${game.badge}</span>
          ${playControl}
        </div>
      `
      grid.appendChild(card)
    }
  }

  renderGrid()
})()
