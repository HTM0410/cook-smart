import React, { useState } from 'react';
import { IngredientConflict } from '../../types/mealPlan';

interface ConflictAlertProps {
  conflicts: IngredientConflict[];
}

const ConflictAlert: React.FC<ConflictAlertProps> = ({ conflicts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  const highSeverityCount = conflicts.filter((c) => c.severity === 'high').length;
  const mediumSeverityCount = conflicts.filter((c) => c.severity === 'medium').length;

  const severityConfig = {
    high: {
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      borderColor: 'border-red-300 dark:border-red-700',
      textColor: 'text-red-800 dark:text-red-300',
      iconColor: 'text-red-500',
      label: 'Nghiêm trọng',
    },
    medium: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      borderColor: 'border-yellow-300 dark:border-yellow-700',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      iconColor: 'text-yellow-500',
      label: 'Trung bình',
    },
    low: {
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      borderColor: 'border-blue-300 dark:border-blue-700',
      textColor: 'text-blue-800 dark:text-blue-300',
      iconColor: 'text-blue-500',
      label: 'Nhẹ',
    },
  };

  return (
    <div className={`mb-6 border-2 rounded-xl overflow-hidden ${severityConfig.high.bgColor} ${severityConfig.high.borderColor}`}>
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-white dark:bg-gray-800 ${severityConfig.high.iconColor}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className={`font-bold ${severityConfig.high.textColor}`}>
              Cảnh báo nguyên liệu tương khắc
            </h3>
            <p className={`text-sm ${severityConfig.high.textColor} opacity-80`}>
              Phát hiện {conflicts.length} cặp nguyên liệu kỵ nhau trong thực đơn của bạn
              {highSeverityCount > 0 && ` (${highSeverityCount} nghiêm trọng)`}
              {mediumSeverityCount > 0 && ` (${mediumSeverityCount} trung bình)`}
            </p>
          </div>
        </div>
        <button className={`p-2 ${severityConfig.high.textColor}`}>
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {conflicts.map((conflict, index) => {
            const config = severityConfig[conflict.severity];
            return (
              <div
                key={`${conflict.ingredientId1}-${conflict.ingredientId2}-${index}`}
                className={`p-3 bg-white dark:bg-gray-800 rounded-lg border ${config.borderColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${config.iconColor}`}>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className={`font-medium ${config.textColor}`}>
                      {conflict.ingredientName1} kỵ với {conflict.ingredientName2}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {conflict.conflictReason}
                    </p>
                    {conflict.affectedRecipes && conflict.affectedRecipes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {conflict.affectedRecipes.map((recipe, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                          >
                            {recipe.recipeName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConflictAlert;
