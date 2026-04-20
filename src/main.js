import './style.css'

import { APP_TEMPLATE } from './game/template.js'

const app = document.querySelector('#app')

app.innerHTML = APP_TEMPLATE

const startButton = app.querySelector('.start-button')
let gamePromise

startButton.addEventListener('click', () => {
  gamePromise ??= import('./game/runtime.js').then(({ createGame }) =>
    createGame({ app }),
  )

  void gamePromise.then((game) => game.showGameScreen())
})
