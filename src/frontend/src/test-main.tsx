import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import FeaturedRecipes from './components/organisms/FeaturedRecipes'

const TestApp = () => (
  <div>
    <FeaturedRecipes />
  </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <TestApp />
    </BrowserRouter>
  </React.StrictMode>,
)
