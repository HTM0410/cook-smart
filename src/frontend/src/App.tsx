import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { MealPlanProvider } from './contexts/MealPlanContext'
import Layout from './components/templates/Layout'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Lazy loaded pages
const HomePage = lazy(() => import('./pages/HomePage'))
const RecipesPage = lazy(() => import('./pages/RecipesPage'))
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const RecipeDetailDemo = lazy(() => import('./pages/RecipeDetailDemo'))
const ComponentDemo = lazy(() => import('./components/pages/ComponentDemo'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const AdminRecipes = lazy(() => import('./pages/AdminRecipes'))
const AdminIngredients = lazy(() => import('./pages/AdminIngredients'))
const AdminIngredientCategories = lazy(() => import('./pages/AdminIngredientCategories'))
const AdminComments = lazy(() => import('./pages/AdminComments'))
const AdminMlops = lazy(() => import('./pages/AdminMlops'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'))
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'))
const MealPlanPage = lazy(() => import('./pages/MealPlanPage'))
const GroceryListPage = lazy(() => import('./pages/GroceryListPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))

function App() {
  return (
    <ThemeProvider>
      <MealPlanProvider>
        <div className="min-h-screen bg-background text-foreground">
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
            toastClassName="!rounded-2xl !shadow-xl !font-medium"
          />
          <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Đang tải...</div>}>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="recipes" element={<RecipesPage />} />
                <Route path="recipes/:id" element={<RecipeDetailPage />} />
                <Route path="demo/recipe" element={<RecipeDetailDemo />} />
                <Route path="demo/components" element={<ComponentDemo />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="categories/:type/:name" element={<CategoriesPage />} />
                <Route path="favorites" element={<FavoritesPage />} />
                <Route path="chat" element={<ChatPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="meal-plans" element={<MealPlanPage />} />
                <Route path="meal-plans/:id" element={<MealPlanPage />} />
                <Route path="meal-plans/:id/grocery-list" element={<GroceryListPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/recipes" element={<AdminRecipes />} />
              <Route path="/admin/ingredients" element={<AdminIngredients />} />
              <Route path="/admin/ingredients/categories" element={<AdminIngredientCategories />} />
              <Route path="/admin/comments" element={<AdminComments />} />
              <Route path="/admin/mlops" element={<AdminMlops />} />
            </Routes>
          </Suspense>
        </div>
      </MealPlanProvider>
    </ThemeProvider>
  )
}

export default App
