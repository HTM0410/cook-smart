import React, { useState, useRef, useEffect } from 'react';
import { RecipeStep } from '../../types/recipe';
import { Check, ChevronRight } from 'lucide-react';

interface RecipeStepsProps {
  steps: RecipeStep[];
}

const RecipeSteps: React.FC<RecipeStepsProps> = ({ steps }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Smooth scroll to current step when it changes
  useEffect(() => {
    const el = stepRefs.current[currentStep];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, [currentStep]);

  const handleStepComplete = (stepNumber: number) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepNumber)) {
      newCompleted.delete(stepNumber);
    } else {
      newCompleted.add(stepNumber);
    }
    setCompletedSteps(newCompleted);
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const completedCount = completedSteps.size;
  const progressPercentage = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header with Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
            <Check className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              Các bước thực hiện
            </h2>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {completedCount}/{steps.length} bước đã hoàn thành
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full sm:w-1/3 space-y-2">
          <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span>Tiến độ</span>
            <span className="text-primary-600 dark:text-primary-400">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* All Steps List (Timeline View) */}
      <div className="relative mt-8 pl-4 md:pl-0">
        {/* Timeline Line */}
        <div className="absolute left-8 md:left-[39px] top-4 bottom-8 w-1 bg-gray-100 dark:bg-gray-800 rounded-full hidden md:block"></div>
        
        <div className="space-y-6">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.stepNumber);
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id}
              ref={(el) => { stepRefs.current[index] = el; }}
              className={`relative flex flex-col md:flex-row gap-6 group transition-all duration-300 ${
                isCompleted ? 'opacity-70 hover:opacity-100' : ''
              }`}
            >
              {/* Step Number Badge */}
              <div className="md:w-20 flex-shrink-0 flex md:justify-center z-10 relative pt-2">
                <button
                  onClick={() => {
                    setCurrentStep(index);
                    handleStepComplete(step.stepNumber);
                  }}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold shadow-sm transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white hover:bg-green-600 hover:scale-110 hover:shadow-green-500/30'
                      : isCurrent
                      ? 'bg-white dark:bg-gray-800 border-primary-500 text-primary-600 dark:text-primary-400 scale-110 shadow-primary-500/20'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:border-primary-300 hover:text-primary-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    step.stepNumber
                  )}
                </button>
              </div>

              {/* Step Content Card */}
              <div 
                className={`flex-1 rounded-2xl p-6 transition-all duration-300 cursor-pointer border ${
                  isCurrent
                    ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800 shadow-md transform md:-translate-x-2'
                    : isCompleted
                    ? 'bg-gray-50 dark:bg-gray-800/50 border-transparent shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-primary-100 dark:hover:border-primary-900/50'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className={`text-xl font-bold ${
                    isCompleted ? 'text-gray-500 dark:text-gray-400 line-through decoration-2 decoration-green-500/50' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    Bước {step.stepNumber}
                  </h3>
                </div>
                <p className={`text-base md:text-lg leading-relaxed ${
                  isCompleted ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {step.instruction}
                </p>
                {/* Decorative dots for current step */}
                {isCurrent && (
                  <div className="absolute -left-2 top-1/2 w-4 h-4 bg-primary-500 rounded-full hidden md:block shadow-glow animate-pulse-soft"></div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-gray-100 dark:border-gray-800 mt-8">
        <button
          onClick={() => setCompletedSteps(new Set())}
          className="flex-1 rounded-xl bg-gray-100 px-6 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors focus:ring-2 focus:ring-gray-300"
        >
          Làm lại từ đầu
        </button>
        <button
          onClick={() => setCompletedSteps(new Set(steps.map((step) => step.stepNumber)))}
          className="flex-1 rounded-xl bg-primary-100 px-6 py-3.5 text-sm font-bold text-primary-700 hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50 transition-colors focus:ring-2 focus:ring-primary-300"
        >
          Đánh dấu hoàn tất cả
        </button>
      </div>
    </div>
  );
};

export default RecipeSteps;
