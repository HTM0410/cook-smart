import sequelize from '../config/database-supabase';
import User from './User';
import Admin from './Admin';
import Ingredient from './Ingredient';
import IngredientCategory from './IngredientCategory';
import Recipe from './Recipe';
import RecipeStep from './RecipeStep';
import RecipeIngredient from './RecipeIngredient';
import UserFavorite from './UserFavorite';
import RecipeReview from './RecipeReview';
import PendingIngredient from './PendingIngredient';
import Comment from './Comment';
import RecipeCategory from './RecipeCategory';
import RecipeCategoryMap from './RecipeCategoryMap';
import UserView from './UserView';
import RecipeEmbedding from './RecipeEmbedding';
import ChatSession from './ChatSession';
import ChatMessage from './ChatMessage';
import MealPlan from './MealPlan';
import MealPlanItem from './MealPlanItem';
import IngredientConflict from './IngredientConflict';
import DetectionHistory from './DetectionHistory';
import DetectionCorrection from './DetectionCorrection';
// import SearchKeyword from './SearchKeyword'; // Tạm thời comment để debug

// Define associations
// Admin -> Recipe
Admin.hasMany(Recipe, { foreignKey: 'createdBy', as: 'recipes' });
Recipe.belongsTo(Admin, { foreignKey: 'createdBy', as: 'creator' });

// Recipe -> RecipeStep
Recipe.hasMany(RecipeStep, { foreignKey: 'recipeId', as: 'steps' });
RecipeStep.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// IngredientCategory -> Ingredient
IngredientCategory.hasMany(Ingredient, { foreignKey: 'categoryId', as: 'ingredients' });
Ingredient.belongsTo(IngredientCategory, { foreignKey: 'categoryId', as: 'category' });

// Recipe <-> Ingredient (Many-to-Many)
Recipe.belongsToMany(Ingredient, { 
  through: RecipeIngredient, 
  foreignKey: 'recipeId',
  otherKey: 'ingredientId',
  as: 'ingredients'
});
Ingredient.belongsToMany(Recipe, { 
  through: RecipeIngredient, 
  foreignKey: 'ingredientId',
  otherKey: 'recipeId',
  as: 'recipes'
});

// User <-> Recipe (Many-to-Many through UserFavorite)
User.belongsToMany(Recipe, { 
  through: UserFavorite, 
  foreignKey: 'userId',
  otherKey: 'recipeId',
  as: 'favoriteRecipes'
});
Recipe.belongsToMany(User, { 
  through: UserFavorite, 
  foreignKey: 'recipeId',
  otherKey: 'userId',
  as: 'favoritedBy'
});

// UserFavorite direct associations (for eager loading)
UserFavorite.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
UserFavorite.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> RecipeReview
User.hasMany(RecipeReview, { foreignKey: 'userId', as: 'reviews' });
RecipeReview.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Recipe -> RecipeReview
Recipe.hasMany(RecipeReview, { foreignKey: 'recipeId', as: 'reviews' });
RecipeReview.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// User -> PendingIngredient (submitted)
User.hasMany(PendingIngredient, { foreignKey: 'submittedBy', as: 'submittedIngredients' });
PendingIngredient.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

// User -> PendingIngredient (reviewed)
User.hasMany(PendingIngredient, { foreignKey: 'reviewedBy', as: 'reviewedIngredients' });
PendingIngredient.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

// IngredientCategory -> PendingIngredient
IngredientCategory.hasMany(PendingIngredient, { foreignKey: 'categoryId', as: 'pendingIngredients' });
PendingIngredient.belongsTo(IngredientCategory, { foreignKey: 'categoryId', as: 'category' });

// User -> Comment
User.hasMany(Comment, { foreignKey: 'userId', as: 'comments' });
Comment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Recipe -> Comment
Recipe.hasMany(Comment, { foreignKey: 'recipeId', as: 'comments' });
Comment.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// Comment -> Comment (self-referencing for replies)
Comment.hasMany(Comment, { foreignKey: 'parentId', as: 'replies' });
Comment.belongsTo(Comment, { foreignKey: 'parentId', as: 'parent' });

// Recipe <-> RecipeCategory (Many-to-Many through RecipeCategoryMap)
Recipe.belongsToMany(RecipeCategory, {
  through: RecipeCategoryMap,
  foreignKey: 'recipeId',
  otherKey: 'categoryId',
  as: 'categories',
});
RecipeCategory.belongsToMany(Recipe, {
  through: RecipeCategoryMap,
  foreignKey: 'categoryId',
  otherKey: 'recipeId',
  as: 'recipes',
});

// RecipeCategoryMap direct associations
RecipeCategoryMap.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });
RecipeCategoryMap.belongsTo(RecipeCategory, { foreignKey: 'categoryId', as: 'category' });

// User -> UserView
User.hasMany(UserView, { foreignKey: 'userId', as: 'views' });
UserView.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Recipe -> UserView
Recipe.hasMany(UserView, { foreignKey: 'recipeId', as: 'views' });
UserView.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// Recipe -> RecipeEmbedding
Recipe.hasOne(RecipeEmbedding, { foreignKey: 'recipeId', as: 'embedding' });
RecipeEmbedding.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// Recipe -> RecipeIngredient
Recipe.hasMany(RecipeIngredient, { foreignKey: 'recipeId', as: 'recipeIngredients' });
RecipeIngredient.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// Ingredient -> RecipeIngredient
Ingredient.hasMany(RecipeIngredient, { foreignKey: 'ingredientId', as: 'recipeIngredients' });
RecipeIngredient.belongsTo(Ingredient, { foreignKey: 'ingredientId', as: 'ingredient' });

// User -> ChatSession
User.hasMany(ChatSession, { foreignKey: 'userId', as: 'chatSessions' });
ChatSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// ChatSession -> ChatMessage
ChatSession.hasMany(ChatMessage, { foreignKey: 'sessionId', as: 'messages' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'sessionId', as: 'session' });

// User -> MealPlan
User.hasMany(MealPlan, { foreignKey: 'userId', as: 'mealPlans' });
MealPlan.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// MealPlan -> MealPlanItem
MealPlan.hasMany(MealPlanItem, { foreignKey: 'mealPlanId', as: 'items' });
MealPlanItem.belongsTo(MealPlan, { foreignKey: 'mealPlanId', as: 'mealPlan' });

// Recipe -> MealPlanItem
Recipe.hasMany(MealPlanItem, { foreignKey: 'recipeId', as: 'mealPlanItems' });
MealPlanItem.belongsTo(Recipe, { foreignKey: 'recipeId', as: 'recipe' });

// Ingredient -> IngredientConflict (ingredient1)
Ingredient.hasMany(IngredientConflict, { foreignKey: 'ingredientId1', as: 'conflicts1' });
IngredientConflict.belongsTo(Ingredient, { foreignKey: 'ingredientId1', as: 'ingredient1' });

// Ingredient -> IngredientConflict (ingredient2)
Ingredient.hasMany(IngredientConflict, { foreignKey: 'ingredientId2', as: 'conflicts2' });
IngredientConflict.belongsTo(Ingredient, { foreignKey: 'ingredientId2', as: 'ingredient2' });

// User -> DetectionHistory
User.hasMany(DetectionHistory, { foreignKey: 'submittedBy', as: 'detectionHistory' });
DetectionHistory.belongsTo(User, { foreignKey: 'submittedBy', as: 'submitter' });

// DetectionHistory -> DetectionCorrection
DetectionHistory.hasMany(DetectionCorrection, { foreignKey: 'detectionHistoryId', as: 'corrections' });
DetectionCorrection.belongsTo(DetectionHistory, { foreignKey: 'detectionHistoryId', as: 'detectionHistory' });

// User -> DetectionCorrection (reviewer)
User.hasMany(DetectionCorrection, { foreignKey: 'reviewedBy', as: 'reviewedCorrections' });
DetectionCorrection.belongsTo(User, { foreignKey: 'reviewedBy', as: 'reviewer' });

// Export models and sequelize instance
export {
  sequelize,
  User,
  Admin,
  Ingredient,
  IngredientCategory,
  Recipe,
  RecipeStep,
  RecipeIngredient,
  UserFavorite,
  RecipeReview,
  PendingIngredient,
  Comment,
  RecipeCategory,
  RecipeCategoryMap,
  UserView,
  RecipeEmbedding,
  ChatSession,
  ChatMessage,
  MealPlan,
  MealPlanItem,
  IngredientConflict,
  DetectionHistory,
  DetectionCorrection,
  // SearchKeyword, // Tạm thời comment để debug
};

export default {
  sequelize,
  User,
  Admin,
  Ingredient,
  IngredientCategory,
  Recipe,
  RecipeStep,
  RecipeIngredient,
  UserFavorite,
  RecipeReview,
  PendingIngredient,
  Comment,
  RecipeCategory,
  RecipeCategoryMap,
  UserView,
  RecipeEmbedding,
  ChatSession,
  ChatMessage,
  MealPlan,
  MealPlanItem,
  IngredientConflict,
  DetectionHistory,
  DetectionCorrection,
  // SearchKeyword, // Tạm thời comment để debug
};
