import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import HeroSection from '../components/organisms/HeroSection'
import CategoriesSection from '../components/organisms/CategoriesSection'
import FeaturedRecipes from '../components/organisms/FeaturedRecipes'
import PopularRecipes from '../components/organisms/PopularRecipes'
import MealPlanCTA from '../components/organisms/MealPlanCTA'

const HomePage: React.FC = () => {
  const location = useLocation()

  useEffect(() => {
    if (location.hash === '#search-section') {
      const section = document.getElementById('search-section')
      section?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash])

  return (
    <div className="min-h-screen">
      <HeroSection />
      <div className="relative bg-white dark:bg-gray-900 z-10">
        <CategoriesSection />
        <div className="divider-gradient" />
        <FeaturedRecipes />
        <PopularRecipes />
        <MealPlanCTA />
      </div>
    </div>
  )
}

export default HomePage
