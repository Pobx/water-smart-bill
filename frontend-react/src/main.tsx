import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/kanit/400.css'
import '@fontsource/kanit/600.css'
import '@fontsource/kanit/700.css'
import '@fontsource/sarabun/400.css'
import '@fontsource/sarabun/700.css'
import { App } from './app/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
