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
      <div className="relative bg-[#F7F6F3] dark:bg-[#1a1a1a] z-10">
        <FeaturedRecipes />
        <PopularRecipes />
        <CategoriesSection />
        <MealPlanCTA />
      </div>
    </div>
  )
}

export default HomePage
