export const APP_TEMPLATE = `
  <section class="screen screen-home" data-screen="home">
    <div class="panel hero-panel home-panel">
      <div class="home-hero">
        <p class="eyebrow">Made By Stig & his dad</p>
        <h1>Race with your friends</h1>
        <p class="hint">
          Drop into a fast arcade racing experience built for players who want
          clean laps, clutch boosts, and bragging rights against their friends.
        </p>
      </div>

      <div class="home-grid">
        <section class="setup-card">
          <div class="card-heading">
            <span class="card-kicker">Player Setup</span>
            <h2>Ready to race</h2>
          </div>
          <label class="field">
            <span class="field-label">Display name</span>
            <input
              class="text-input"
              type="text"
              maxlength="20"
              placeholder="FastFox"
              data-display-name-input
            />
          </label>
          <label class="field">
            <span class="field-label">Room ID</span>
            <input
              class="text-input"
              type="text"
              maxlength="24"
              placeholder="room-1234abcd"
              data-room-id-input
            />
          </label>
          <div class="button-row">
            <button class="start-button" type="button">Start Race</button>
          </div>
          <p class="form-message" data-identity-message></p>
          <p class="form-message" data-room-status></p>
        </section>

        <section class="leaderboard-card">
          <div class="card-heading">
            <span class="card-kicker">Leaderboard</span>
            <h2>All-time best laps</h2>
          </div>
          <div class="leaderboard-list" data-all-time-leaderboard></div>
        </section>
      </div>
    </div>
  </section>

  <section class="screen screen-game hidden" data-screen="game">
    <div class="game-canvas"></div>
    <aside class="multiplayer-panel">
      <div class="multiplayer-card">
        <div class="room-share-card">
          <div class="card-heading">
            <span class="card-kicker">Room ID</span>
          </div>
          <div class="room-share-row">
            <input
              class="room-share-input"
              type="text"
              readonly
              aria-label="Room ID"
              data-room-id-share-input
            />
            <button class="room-action-button" type="button" data-copy-room-button>
              Copy Link
            </button>
            <button class="room-action-button room-action-button--ghost" type="button" data-leave-room-button>
              Leave
            </button>
          </div>
        </div>
        <div class="player-list-card">
          <div class="player-list-heading">
            <span>Connected players</span>
            <span data-player-count>0</span>
          </div>
          <div class="player-list" data-player-list></div>
        </div>
      </div>
    </aside>
    <div class="race-hud">
      <div class="speedometer" aria-live="polite" aria-atomic="true">
        <span class="speedometer-label">Speed</span>
        <div class="speedometer-readout">
          <span class="speedometer-value">0</span>
          <span class="speedometer-unit">km/h</span>
        </div>
      </div>
      <div class="lap-timers" aria-live="polite" aria-relevant="additions text"></div>
    </div>
    <div class="touch-controls">
      <div class="touch-actions">
        <button class="touch-boost hidden" type="button" aria-label="Hold for Boost">
          <span class="touch-button-kicker">Hold</span>
          <span class="touch-button-label">Boost</span>
          <span class="touch-button-meta">keep pressed</span>
        </button>
        <button
          class="touch-superboost hidden"
          type="button"
          aria-label="Hold for Super Boost"
        >
          <span class="touch-button-kicker">Hold</span>
          <span class="touch-button-label">Super Boost</span>
          <span class="touch-button-meta">keep pressed</span>
        </button>
      </div>
      <div class="minimap" aria-hidden="true">
        <span class="minimap-label">Track Map</span>
        <span class="minimap-hint">
          <span>F camera</span>
          <span>R Reset</span>
          <span>B boost</span>
        </span>
        <canvas class="minimap-canvas"></canvas>
      </div>
    </div>
    <div class="finish-celebration">
      <div class="finish-particles"></div>
      <div class="finish-flare"></div>
      <div class="finish-burst-ring"></div>
      <div class="finish-kicker" aria-live="polite" aria-atomic="true"></div>
      <div class="finish-notice" aria-live="polite" aria-atomic="true">FINISHED</div>
      <div class="finish-subtitle">Lap Complete</div>
    </div>
    <div class="finish-celebration finish-celebration--danger">
      <div class="finish-flare"></div>
      <div class="finish-burst-ring"></div>
      <div class="finish-notice" aria-live="assertive" aria-atomic="true">GAME OVER</div>
      <div class="finish-subtitle game-over-subtitle">Press R, Enter, or Space to respawn</div>
    </div>
    <div class="race-countdown" aria-live="assertive" aria-atomic="true">
      <div class="race-countdown-value">3</div>
      <div class="race-countdown-label">Get Ready</div>
    </div>
  </section>
`
