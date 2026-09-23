import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initReveal } from './site/reveal'
import { initTyping } from './site/typing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The static article in index.html is outside #root, so these run against
// the DOM directly rather than from an effect. Both are no-ops under
// reduced motion, and both leave the page untouched if they never run —
// see the notes in each file.
initReveal()
initTyping()
