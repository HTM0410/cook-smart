import { Request, Response } from 'express';
import { Recipe } from '../models';

/**
 * Generate share preview metadata for a recipe
 * This endpoint generates dynamic OG tags for social media sharing
 */
export const getRecipeSharePreview = async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.params;

    const recipe = await Recipe.findByPk(recipeId, {
      attributes: [
        'id',
        'recipeName',
        'description',
        'imageUrl',
        'prepTime',
        'cookTime',
        'servings',
        'difficulty',
      ],
    });

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found',
      });
    }

    // Generate share preview HTML with OG tags
    const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/recipes/${recipeId}`;
    const imageUrl = recipe.imageUrl || `${process.env.CLIENT_URL}/default-recipe.jpg`;
    
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${recipe.recipeName} - CookSmart</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="${recipe.recipeName} - CookSmart">
  <meta name="description" content="${recipe.description || 'Khám phá công thức nấu ăn tuyệt vời này trên CookSmart!'}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:title" content="${recipe.recipeName}">
  <meta property="og:description" content="${recipe.description || 'Khám phá công thức nấu ăn tuyệt vời này trên CookSmart!'}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="CookSmart">
  <meta property="og:locale" content="vi_VN">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${shareUrl}">
  <meta property="twitter:title" content="${recipe.recipeName}">
  <meta property="twitter:description" content="${recipe.description || 'Khám phá công thức nấu ăn tuyệt vời này trên CookSmart!'}">
  <meta property="twitter:image" content="${imageUrl}">
  
  <!-- Additional Recipe Metadata -->
  <meta property="recipe:prep_time" content="${recipe.prepTime}">
  <meta property="recipe:cook_time" content="${recipe.cookTime}">
  <meta property="recipe:servings" content="${recipe.servings}">
  <meta property="recipe:difficulty" content="${recipe.difficulty}">
  
  <script>
    // Redirect to actual recipe page after meta tags are loaded
    window.location.href = '${shareUrl}';
  </script>
</head>
<body>
  <p>Đang chuyển hướng đến công thức...</p>
</body>
</html>
    `.trim();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error: any) {
    console.error('Error generating share preview:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate share preview',
      error: error.message,
    });
  }
};

/**
 * Track share analytics
 */
export const trackShare = async (req: Request, res: Response) => {
  try {
    const { recipeId, platform } = req.body;

    if (!recipeId || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Recipe ID and platform are required',
      });
    }

    // TODO: Store share analytics in database
    // For now, just log it
    console.log(`📊 Share tracked: Recipe ${recipeId} shared via ${platform}`);

    return res.json({
      success: true,
      message: 'Share tracked successfully',
      data: {
        recipeId,
        platform,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error tracking share:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to track share',
      error: error.message,
    });
  }
};

