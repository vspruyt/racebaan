export const APP_TEMPLATE = `
  <section class="screen screen-home" data-screen="home">
    <div class="panel hero-panel">
      <p class="eyebrow">Made By Stig & his dad</p>
      <h1>Race with your friends</h1>
      <p class="hint">
        Drop into a fast arcade racing experience built for players who want
        clean laps, clutch boosts, and bragging rights against their friends.
      </p>
      <button class="start-button" type="button">Start Race</button>
    </div>
  </section>

  <section class="screen screen-game hidden" data-screen="game">
    <div class="game-canvas"></div>
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
      <button class="touch-boost hidden" type="button" aria-label="Boost">Boost</button>
      <button class="touch-superboost hidden" type="button" aria-label="Super Boost">
        Super Boost
      </button>
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
  </section>
`
