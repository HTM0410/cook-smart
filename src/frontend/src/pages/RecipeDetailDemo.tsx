import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  ChefHat, 
  Timer,
  UtensilsCrossed,
  Tag
} from 'lucide-react';
import CommentSection from '../components/organisms/CommentSection';
import RatingSection from '../components/organisms/RatingSection';
import IngredientChecklist from '../components/organisms/IngredientChecklist';
import FavoriteButton from '../components/atoms/FavoriteButton';
import RecipeShareButton from '../components/molecules/RecipeShareButton';
import RecipeSteps from '../components/organisms/RecipeSteps';

// Dữ liệu mẫu công thức đầy đủ
const mockRecipe = {
  id: 1,
  recipeName: 'Phở Bò Hà Nội',
  description: 'Món phở bò truyền thống của Hà Nội với nước dùng đậm đà, thịt bò tái chín, bánh phở mềm và các loại rau thơm. Đây là món ăn đặc trưng của ẩm thực Việt Nam, được yêu thích trên toàn thế giới.',
  prepTime: 30,
  cookTime: 120,
  servings: 4,
  difficulty: 'medium' as const,
  imageUrl: 'https://www.lacademie.com/wp-content/uploads/2022/09/a-delicious-bowl-of-pho-500x375.jpg',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-20T15:30:00Z',
  status: 'visible',
  categories: [
    { id: 1, categoryName: 'Món chính', categoryType: 'dish_type' },
    { id: 2, categoryName: 'Món Việt Nam', categoryType: 'cuisine' },
    { id: 3, categoryName: 'Món nóng', categoryType: 'temperature' }
  ],
  ingredients: [
    {
      id: 1,
      quantity: '500',
      unit: 'g',
      ingredient: {
        id: 1,
        ingredientName: 'Thịt bò tái',
        description: 'Thịt bò tươi, thái mỏng'
      }
    },
    {
      id: 2,
      quantity: '1',
      unit: 'kg',
      ingredient: {
        id: 2,
        ingredientName: 'Xương bò',
        description: 'Xương ống bò để nấu nước dùng'
      }
    },
    {
      id: 3,
      quantity: '500',
      unit: 'g',
      ingredient: {
        id: 3,
        ingredientName: 'Bánh phở',
        description: 'Bánh phở tươi hoặc khô'
      }
    },
    {
      id: 4,
      quantity: '2',
      unit: 'củ',
      ingredient: {
        id: 4,
        ingredientName: 'Hành tây',
        description: 'Hành tây nướng thơm'
      }
    },
    {
      id: 5,
      quantity: '1',
      unit: 'củ',
      ingredient: {
        id: 5,
        ingredientName: 'Gừng',
        description: 'Gừng tươi, nướng'
      }
    },
    {
      id: 6,
      quantity: '3',
      unit: 'nhánh',
      ingredient: {
        id: 6,
        ingredientName: 'Hành lá',
        description: 'Hành lá tươi, thái nhỏ'
      }
    },
    {
      id: 7,
      quantity: '1',
      unit: 'bó',
      ingredient: {
        id: 7,
        ingredientName: 'Rau thơm',
        description: 'Ngò gai, húng quế, giá đỗ'
      }
    },
    {
      id: 8,
      quantity: '2',
      unit: 'quả',
      ingredient: {
        id: 8,
        ingredientName: 'Chanh',
        description: 'Chanh tươi để vắt'
      }
    },
    {
      id: 9,
      quantity: '1',
      unit: 'hộp',
      ingredient: {
        id: 9,
        ingredientName: 'Tương ớt',
        description: 'Tương ớt Hải Phòng'
      }
    },
    {
      id: 10,
      quantity: '50',
      unit: 'g',
      ingredient: {
        id: 10,
        ingredientName: 'Gia vị phở',
        description: 'Quế, hoa hồi, thảo quả, đinh hương'
      }
    }
  ],
  steps: [
    {
      id: 1,
      stepNumber: 1,
      instruction: 'Rửa sạch xương bò, chần qua nước sôi để loại bỏ tạp chất. Cho xương vào nồi lớn, đổ nước ngập xương và đun sôi.'
    },
    {
      id: 2,
      stepNumber: 2,
      instruction: 'Nướng hành tây và gừng trên bếp than hoặc lò nướng cho đến khi thơm vàng. Đập dập và cho vào nồi nước dùng.'
    },
    {
      id: 3,
      stepNumber: 3,
      instruction: 'Cho các gia vị phở (quế, hoa hồi, thảo quả, đinh hương) vào túi vải hoặc hộp gia vị, thả vào nồi. Hạ lửa nhỏ và ninh trong 2-3 giờ.'
    },
    {
      id: 4,
      stepNumber: 4,
      instruction: 'Trong lúc đợi nước dùng, chuẩn bị thịt bò: thái mỏng, để đông lạnh 30 phút trước khi thái sẽ dễ hơn. Rửa sạch bánh phở.'
    },
    {
      id: 5,
      stepNumber: 5,
      instruction: 'Khi nước dùng đã trong và thơm, nêm nếm gia vị cho vừa miệng. Vớt xương và gia vị ra, giữ nước dùng nóng.'
    },
    {
      id: 6,
      stepNumber: 6,
      instruction: 'Trần bánh phở qua nước sôi, để ráo. Xếp bánh phở vào tô, đặt thịt bò tái lên trên.'
    },
    {
      id: 7,
      stepNumber: 7,
      instruction: 'Rưới nước dùng nóng vào tô, thịt bò sẽ chín tái. Thêm hành lá, rau thơm, giá đỗ lên trên.'
    },
    {
      id: 8,
      stepNumber: 8,
      instruction: 'Dọn kèm chanh, tương ớt, tương đen. Thưởng thức ngay khi còn nóng!'
    }
  ]
};

const RecipeDetailDemo: React.FC = () => {
  const navigate = useNavigate();
  const [recipe] = useState(mockRecipe);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'hard':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'Dễ';
      case 'medium':
        return 'Trung bình';
      case 'hard':
        return 'Khó';
      default:
        return difficulty;
    }
  };

  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section với ảnh lớn */}
      <div className="relative w-full h-[60vh] min-h-[500px] max-h-[700px] overflow-hidden">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.recipeName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20 flex items-center justify-center">
            <ChefHat className="h-24 w-24 text-gray-400 dark:text-gray-600" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Back Button */}
        <div className="absolute top-6 left-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 rounded-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 text-gray-900 dark:text-gray-100 hover:bg-white dark:hover:bg-gray-800 transition-all shadow-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>
        </div>

        {/* Favorite & Share Buttons */}
        <div className="absolute top-6 right-6 flex items-center space-x-3">
          <RecipeShareButton 
            recipeId={recipe.id}
            recipeName={recipe.recipeName}
            recipeImage={recipe.imageUrl}
            recipeDescription={recipe.description}
          />
          <FavoriteButton
            recipeId={recipe.id}
            initialFavoriteCount={156}
            initialIsFavorited={false}
            userId={1}
            size="lg"
            showCount={false}
            showTooltip={true}
          />
        </div>

        {/* Recipe Title & Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between flex-wrap gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-lg">
                  {recipe.recipeName}
                </h1>
                {recipe.description && (
                  <p className="text-lg md:text-xl text-white/90 mb-6 max-w-3xl drop-shadow-md">
                    {recipe.description}
                  </p>
                )}
                
                {/* Quick Stats */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                    <Clock className="h-5 w-5 text-white" />
                    <span className="text-white font-medium">{totalTime} phút</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                    <Users className="h-5 w-5 text-white" />
                    <span className="text-white font-medium">{recipe.servings} người</span>
                  </div>
                  <div className={`flex items-center space-x-2 rounded-full px-4 py-2 ${getDifficultyColor(recipe.difficulty)}`}>
                    <ChefHat className="h-5 w-5" />
                    <span className="font-medium">{getDifficultyText(recipe.difficulty)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Detailed Stats Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                  Thông tin chi tiết
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <Timer className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {recipe.prepTime}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Chuẩn bị (phút)</div>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                    <UtensilsCrossed className="h-8 w-8 text-orange-600 dark:text-orange-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {recipe.cookTime}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Nấu (phút)</div>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                    <Users className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {recipe.servings}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Khẩu phần</div>
                  </div>
                  
                  <div className="text-center p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {totalTime}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tổng thời gian</div>
                  </div>
                </div>
              </div>

              {/* Categories/Tags */}
              {recipe.categories && recipe.categories.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center space-x-2 mb-4">
                    <Tag className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Phân loại
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recipe.categories.map((category) => (
                      <span
                        key={category.id}
                        className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-400"
                      >
                        {category.categoryName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps Section */}
              {recipe.steps && recipe.steps.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                  <RecipeSteps steps={recipe.steps} />
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Rating Section - Không sticky */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <RatingSection 
                  recipeId={recipe.id} 
                  mockStats={{
                    averageRating: 4.6,
                    ratingCount: 128,
                    distribution: {
                      5: 85,  // 85 người đánh giá 5 sao
                      4: 32,  // 32 người đánh giá 4 sao
                      3: 8,   // 8 người đánh giá 3 sao
                      2: 2,   // 2 người đánh giá 2 sao
                      1: 1    // 1 người đánh giá 1 sao
                    },
                    userRating: null
                  }}
                />
              </div>

              {/* Ingredients Checklist (Compact) */}
              {recipe.ingredients && recipe.ingredients.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                  <IngredientChecklist
                    recipeId={recipe.id}
                    ingredients={recipe.ingredients.map((ing) => ({
                      id: ing.id,
                      quantity: String(ing.quantity),
                      unit: ing.unit || '',
                      ingredient: ing.ingredient
                    }))}
                    searchedIngredients={[]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="mt-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
              <CommentSection
                recipeId={recipe.id}
                currentUserId={1}
                initialCommentsCount={0}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeDetailDemo;
