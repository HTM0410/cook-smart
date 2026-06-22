/**
 * Matrix Service
 * Hỗ trợ các phép toán ma trận cho Collaborative Filtering
 * Triển khai SVD (Singular Value Decomposition)
 */

import { InteractionMatrix, SVDFactors, PredictedRating } from '../../types/recommendation';

class MatrixService {
  /**
   * Tạo sparse interaction matrix từ raw interactions
   */
  buildInteractionMatrix(
    userIds: number[],
    recipeIds: number[],
    interactions: Map<string, number>
  ): InteractionMatrix {
    const users = new Map<number, number>();
    const recipes = new Map<number, number>();

    // Map userId -> row index
    userIds.forEach((userId, idx) => users.set(userId, idx));

    // Map recipeId -> col index
    recipeIds.forEach((recipeId, idx) => recipes.set(recipeId, idx));

    // Initialize matrix with zeros
    const rows = userIds.length;
    const cols = recipeIds.length;
    const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

    // Fill matrix with interaction scores
    const sparseIndices = new Set<string>();
    interactions.forEach((score, key) => {
      const [userId, recipeId] = key.split(',').map(Number);
      const rowIdx = users.get(userId);
      const colIdx = recipes.get(recipeId);

      if (rowIdx !== undefined && colIdx !== undefined) {
        matrix[rowIdx][colIdx] = score;
        sparseIndices.add(`${rowIdx},${colIdx}`);
      }
    });

    return { users, recipes, matrix, sparseIndices };
  }

  /**
   * Chuẩn hóa ma trận (mean centering)
   */
  normalizeMatrix(matrix: number[][]): { normalized: number[][]; rowMeans: number[] } {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const normalized: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
    const rowMeans: number[] = [];

    for (let i = 0; i < rows; i++) {
      // Calculate row mean (ignoring zeros)
      const nonZeroValues = matrix[i].filter(v => v !== 0);
      const mean = nonZeroValues.length > 0
        ? nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length
        : 0;
      rowMeans.push(mean);

      // Normalize
      for (let j = 0; j < cols; j++) {
        if (matrix[i][j] !== 0) {
          normalized[i][j] = matrix[i][j] - mean;
        }
      }
    }

    return { normalized, rowMeans };
  }

  /**
   * Triển khai SVD đơn giản sử dụng power iteration
   * Trả về factors cho collaborative filtering
   */
  performSVD(
    matrix: number[][],
    k: number = 20,
    maxIterations: number = 100
  ): SVDFactors {
    const rows = matrix.length;
    const cols = matrix[0].length;

    // Initialize factors randomly
    let userFactors: number[][] = Array.from({ length: rows }, () =>
      Array.from({ length: k }, () => Math.random() * 0.1)
    );
    let recipeFactors: number[][] = Array.from({ length: cols }, () =>
      Array.from({ length: k }, () => Math.random() * 0.1)
    );
    let singularValues: number[] = Array(k).fill(1);

    // Alternating Least Squares (ALS) approach
    for (let iter = 0; iter < maxIterations; iter++) {
      // Update user factors
      for (let i = 0; i < rows; i++) {
        const nonZeroCols: number[] = [];
        for (let j = 0; j < cols; j++) {
          if (matrix[i][j] !== 0) {
            nonZeroCols.push(j);
          }
        }

        if (nonZeroCols.length === 0) continue;

        // Solve: (R_i^T * R_i + lambda * I) * u_i = R_i^T * r_i
        // Simplified: use gradient descent
        for (let f = 0; f < k; f++) {
          let gradient = 0;
          for (const j of nonZeroCols) {
            let dotProduct = 0;
            for (let ff = 0; ff < k; ff++) {
              dotProduct += userFactors[i][ff] * recipeFactors[j][ff];
            }
            gradient += (matrix[i][j] - dotProduct) * recipeFactors[j][f];
          }
          userFactors[i][f] += 0.01 * gradient; // Learning rate
        }
      }

      // Update recipe factors
      for (let j = 0; j < cols; j++) {
        const nonZeroRows: number[] = [];
        for (let i = 0; i < rows; i++) {
          if (matrix[i][j] !== 0) {
            nonZeroRows.push(i);
          }
        }

        if (nonZeroRows.length === 0) continue;

        for (let f = 0; f < k; f++) {
          let gradient = 0;
          for (const i of nonZeroRows) {
            let dotProduct = 0;
            for (let ff = 0; ff < k; ff++) {
              dotProduct += userFactors[i][ff] * recipeFactors[j][ff];
            }
            gradient += (matrix[i][j] - dotProduct) * userFactors[i][f];
          }
          recipeFactors[j][f] += 0.01 * gradient;
        }
      }

      // Calculate singular values (approximation)
      for (let f = 0; f < k; f++) {
        let norm = 0;
        for (let i = 0; i < rows; i++) {
          norm += userFactors[i][f] * userFactors[i][f];
        }
        singularValues[f] = Math.sqrt(norm);
      }
    }

    return { userFactors, recipeFactors, singularValues };
  }

  /**
   * Dự đoán rating cho user-recipe pair sử dụng SVD factors
   */
  predictRating(
    userId: number,
    recipeId: number,
    factors: SVDFactors,
    userIndex: Map<number, number>,
    recipeIndex: Map<number, number>,
    rowMeans: number[]
  ): PredictedRating {
    const userIdx = userIndex.get(userId);
    const recipeIdx = recipeIndex.get(recipeId);

    if (userIdx === undefined || recipeIdx === undefined) {
      return { userId, recipeId, predictedScore: 0, confidence: 0 };
    }

    // Calculate dot product of factors
    let dotProduct = 0;
    let sumWeights = 0;

    for (let f = 0; f < factors.userFactors[userIdx].length; f++) {
      const weight = factors.singularValues[f];
      dotProduct += factors.userFactors[userIdx][f] * factors.recipeFactors[recipeIdx][f] * weight;
      sumWeights += weight * weight;
    }

    // Normalize and add mean
    const mean = rowMeans[userIdx] || 0;
    const predictedScore = mean + dotProduct / Math.sqrt(sumWeights || 1);

    // Confidence based on number of interactions
    const userInteractions = factors.userFactors[userIdx].filter(v => v !== 0).length;
    const confidence = Math.min(userInteractions / 10, 1); // Max confidence after 10 factors

    return {
      userId,
      recipeId,
      predictedScore: Math.max(0, Math.min(5, predictedScore)), // Clamp to 0-5
      confidence,
    };
  }

  /**
   * Tính cosine similarity giữa hai vectors (user hoặc recipe)
   */
  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Tìm top-K items có điểm cao nhất cho một user
   */
  rankItemsForUser(
    userId: number,
    candidateRecipeIds: number[],
    factors: SVDFactors,
    userIndex: Map<number, number>,
    recipeIndex: Map<number, number>,
    rowMeans: number[]
  ): { recipeId: number; score: number }[] {
    const scores: { recipeId: number; score: number }[] = [];
    const userIdx = userIndex.get(userId);

    if (userIdx === undefined) {
      // Cold start user - return uniform scores
      return candidateRecipeIds.map(recipeId => ({ recipeId, score: 0 }));
    }

    for (const recipeId of candidateRecipeIds) {
      const recipeIdx = recipeIndex.get(recipeId);
      if (recipeIdx === undefined) {
        scores.push({ recipeId, score: 0 });
        continue;
      }

      const prediction = this.predictRating(
        userId,
        recipeId,
        factors,
        userIndex,
        recipeIndex,
        rowMeans
      );
      scores.push({ recipeId, score: prediction.predictedScore });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    return scores;
  }

  /**
   * Tính RMSE (Root Mean Square Error) cho predictions
   */
  calculateRMSE(
    predictions: { actual: number; predicted: number }[]
  ): number {
    if (predictions.length === 0) return 0;

    const sumSquaredError = predictions.reduce((sum, { actual, predicted }) => {
      const error = actual - predicted;
      return sum + error * error;
    }, 0);

    return Math.sqrt(sumSquaredError / predictions.length);
  }

  /**
   * Sparsify matrix (keep only top-K per row)
   */
  sparsifyMatrix(matrix: number[][], k: number = 100): number[][] {
    return matrix.map(row => {
      // Get top k values
      const nonZero = row
        .map((val, idx) => ({ val, idx }))
        .filter(item => item.val !== 0)
        .sort((a, b) => b.val - a.val)
        .slice(0, k);

      // Create sparse row
      const sparseRow = Array(row.length).fill(0);
      nonZero.forEach(item => {
        sparseRow[item.idx] = item.val;
      });

      return sparseRow;
    });
  }
}

export const matrixService = new MatrixService();
export default matrixService;
