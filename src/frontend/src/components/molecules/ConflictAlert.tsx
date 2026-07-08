import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, Check } from 'lucide-react';
import { IngredientConflict } from '../../types/mealPlan';
import { easeFluid } from '../../lib/motion';

interface ConflictAlertProps {
  conflicts: IngredientConflict[];
}

const ConflictAlert: React.FC<ConflictAlertProps> = ({ conflicts }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (conflicts.length === 0) return null;

  const normalizeSeverity = (s: string): keyof typeof severityConfig => {
    if (s === 'high' || s === 'medium' || s === 'low') return s;
    if (s === 'danger' || s === 'critical' || s === 'severe') return 'high';
    if (s === 'warning' || s === 'warn') return 'medium';
    return 'medium';
  };

  const severityConfig = {
    high: {
      bg: 'bg-[#FDEBEC]',
      bgSoft: 'bg-[#FDEBEC]/40 dark:bg-[#9F2F2D]/15',
      ring: 'ring-[#9F2F2D]/30',
      text: 'text-[#9F2F2D]',
      dot: 'bg-[#9F2F2D]',
      label: 'Nghiêm trọng',
    },
    medium: {
      bg: 'bg-[#FBF3DB]',
      bgSoft: 'bg-[#FBF3DB]/40 dark:bg-[#956400]/15',
      ring: 'ring-[#956400]/30',
      text: 'text-[#956400]',
      dot: 'bg-[#956400]',
      label: 'Trung bình',
    },
    low: {
      bg: 'bg-[#EDF3EC]',
      bgSoft: 'bg-[#EDF3EC]/40 dark:bg-[#346538]/15',
      ring: 'ring-[#346538]/30',
      text: 'text-[#346538]',
      dot: 'bg-[#346538]',
      label: 'Nhẹ',
    },
  };

  const highSeverityCount = conflicts.filter((c) => normalizeSeverity(c.severity) === 'high').length;
  const mediumSeverityCount = conflicts.filter((c) => normalizeSeverity(c.severity) === 'medium').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeFluid }}
      className="card-bezel mb-6"
    >
      <div className={`card-bezel-inner overflow-hidden ${severityConfig.high.bgSoft}`}>
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-5 flex items-center justify-between gap-4 text-left"
        >
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`flex-shrink-0 w-11 h-11 rounded-full ring-1 ${severityConfig.high.ring} bg-white dark:bg-ink-700 flex items-center justify-center ${severityConfig.high.text}`}>
              <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-base font-semibold ${severityConfig.high.text} mb-1`}>
                Cảnh báo nguyên liệu tương khắc
              </h3>
              <p className={`text-sm ${severityConfig.high.text} opacity-80 text-pretty`}>
                Phát hiện {conflicts.length} cặp nguyên liệu kỵ nhau
                {highSeverityCount > 0 && ` · ${highSeverityCount} nghiêm trọng`}
                {mediumSeverityCount > 0 && ` · ${mediumSeverityCount} trung bình`}
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.4, ease: easeFluid }}
            className={`flex-shrink-0 w-9 h-9 rounded-full ring-1 ${severityConfig.high.ring} bg-white dark:bg-ink-700 flex items-center justify-center ${severityConfig.high.text}`}
          >
            <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
          </motion.div>
        </button>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-2">
                {conflicts.map((conflict, index) => {
                  const config = severityConfig[normalizeSeverity(conflict.severity)];
                  return (
                    <motion.div
                      key={`${conflict.ingredientId1}-${conflict.ingredientId2}-${index}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, ease: easeFluid, delay: index * 0.05 }}
                      className={`p-4 bg-white dark:bg-ink-800 rounded-2xl ring-1 ${config.ring}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-7 h-7 rounded-full ${config.dot} flex items-center justify-center flex-shrink-0`}>
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`eyebrow-tag ${config.bg} ${config.text}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className={`font-semibold text-ink-primary dark:text-paper-light text-balance`}>
                            {conflict.ingredientName1} kỵ với {conflict.ingredientName2}
                          </p>
                          <p className="text-sm text-ink-secondary mt-1 text-pretty">
                            {conflict.conflictReason}
                          </p>
                          {conflict.affectedRecipes && conflict.affectedRecipes.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {conflict.affectedRecipes.map((recipe, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 bg-paper-light dark:bg-ink-700 text-ink-secondary rounded-full text-xs font-medium"
                                >
                                  {recipe.recipeName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ConflictAlert;