import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './shared/design-system/tokens.css'
import './shared/design-system/global.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento de inicialização não encontrado.')
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
