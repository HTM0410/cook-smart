import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  MealPlan,
  MealPlanItem,
  IngredientConflict,
  CreateMealPlanRequest,
  AddRecipeToMealPlanRequest,
  UpdateMealPlanItemRequest,
} from '../types/mealPlan';
import mealPlanService from '../services/mealPlanService';

interface MealPlanState {
  currentPlan: MealPlan | null;
  plans: MealPlan[];
  loading: boolean;
  error: string | null;
  pendingChanges: boolean;
  conflicts: IngredientConflict[];
  isOnline: boolean;
}

type MealPlanAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PLANS'; payload: MealPlan[] }
  | { type: 'SET_CURRENT_PLAN'; payload: MealPlan | null }
  | { type: 'ADD_PLAN'; payload: MealPlan }
  | { type: 'UPDATE_PLAN'; payload: MealPlan }
  | { type: 'DELETE_PLAN'; payload: number }
  | { type: 'ADD_ITEM'; payload: { item: MealPlanItem; conflicts: IngredientConflict[] } }
  | { type: 'REMOVE_ITEM'; payload: { itemId: number; conflicts: IngredientConflict[] } }
  | { type: 'UPDATE_ITEM'; payload: { item: MealPlanItem; conflicts: IngredientConflict[] } }
  | { type: 'SET_CONFLICTS'; payload: IngredientConflict[] }
  | { type: 'SET_PENDING_CHANGES'; payload: boolean }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean };

const initialState: MealPlanState = {
  currentPlan: null,
  plans: [],
  loading: false,
  error: null,
  pendingChanges: false,
  conflicts: [],
  isOnline: true,
};

function mealPlanReducer(state: MealPlanState, action: MealPlanAction): MealPlanState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_PLANS':
      return { ...state, plans: action.payload };
    case 'SET_CURRENT_PLAN':
      return { ...state, currentPlan: action.payload };
    case 'ADD_PLAN':
      return { ...state, plans: [action.payload, ...state.plans] };
    case 'UPDATE_PLAN':
      return {
        ...state,
        plans: state.plans.map((p) => (p.id === action.payload.id ? action.payload : p)),
        currentPlan: state.currentPlan?.id === action.payload.id ? action.payload : state.currentPlan,
      };
    case 'DELETE_PLAN':
      return {
        ...state,
        plans: state.plans.filter((p) => p.id !== action.payload),
        currentPlan: state.currentPlan?.id === action.payload ? null : state.currentPlan,
      };
    case 'ADD_ITEM':
      if (!state.currentPlan) return state;
      return {
        ...state,
        currentPlan: {
          ...state.currentPlan,
          items: [...state.currentPlan.items, action.payload.item],
        },
        conflicts: action.payload.conflicts,
      };
    case 'REMOVE_ITEM':
      if (!state.currentPlan) return state;
      return {
        ...state,
        currentPlan: {
          ...state.currentPlan,
          items: state.currentPlan.items.filter((i) => i.id !== action.payload.itemId),
        },
        conflicts: action.payload.conflicts,
      };
    case 'UPDATE_ITEM':
      if (!state.currentPlan) return state;
      return {
        ...state,
        currentPlan: {
          ...state.currentPlan,
          items: state.currentPlan.items.map((i) =>
            i.id === action.payload.item.id ? action.payload.item : i
          ),
        },
        conflicts: action.payload.conflicts,
      };
    case 'SET_CONFLICTS':
      return { ...state, conflicts: action.payload };
    case 'SET_PENDING_CHANGES':
      return { ...state, pendingChanges: action.payload };
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload };
    default:
      return state;
  }
}

interface MealPlanContextType {
  state: MealPlanState;
  createMealPlan: (data: CreateMealPlanRequest) => Promise<MealPlan | null>;
  fetchPlans: () => Promise<void>;
  fetchMealPlan: (id: number) => Promise<void>;
  addRecipeToMealPlan: (data: AddRecipeToMealPlanRequest) => Promise<void>;
  removeRecipeFromMealPlan: (itemId: number) => Promise<void>;
  updateMealPlanItem: (itemId: number, data: UpdateMealPlanItemRequest) => Promise<void>;
  deleteMealPlan: (id: number) => Promise<void>;
  updateMealPlanStatus: (status: 'active' | 'completed' | 'archived') => Promise<void>;
  clearError: () => void;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

const OFFLINE_QUEUE_KEY = 'mealPlan_offlineQueue';
const DEBOUNCE_MS = 2000;

export function MealPlanProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(mealPlanReducer, initialState);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOperationsRef = useRef<Array<() => Promise<void>>>([]);

  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
      toast.success('Đã kết nối lại. Đang đồng bộ dữ liệu...');
      processOfflineQueue();
    };

    const handleOffline = () => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
      toast.warning('Mất kết nối mạng. Các thay đổi sẽ được lưu khi có mạng trở lại.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    dispatch({ type: 'SET_ONLINE_STATUS', payload: navigator.onLine });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const saveOfflineQueue = useCallback(() => {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(pendingOperationsRef.current));
    } catch (e) {
      console.error('Failed to save offline queue:', e);
    }
  }, []);

  const processOfflineQueue = useCallback(async () => {
    const queue = pendingOperationsRef.current;
    pendingOperationsRef.current = [];
    localStorage.removeItem(OFFLINE_QUEUE_KEY);

    for (const operation of queue) {
      try {
        await operation();
      } catch (e) {
        console.error('Failed to process offline operation:', e);
      }
    }
  }, []);

  const executeWithOfflineSupport = useCallback(
    async (operation: () => Promise<void>) => {
      if (!state.isOnline) {
        pendingOperationsRef.current.push(operation);
        saveOfflineQueue();
        return;
      }

      try {
        await operation();
      } catch (e) {
        console.error('Operation failed:', e);
      }
    },
    [state.isOnline, saveOfflineQueue]
  );

  const createMealPlan = useCallback(async (data: CreateMealPlanRequest): Promise<MealPlan | null> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await mealPlanService.createMealPlan(data);
      if (response.success && response.data) {
        dispatch({ type: 'ADD_PLAN', payload: response.data });
        dispatch({ type: 'SET_CURRENT_PLAN', payload: response.data });
        toast.success('Tạo thực đơn thành công!');
        return response.data;
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to create meal plan' });
        toast.error(response.message || 'Không thể tạo thực đơn');
        return null;
      }
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', payload: e.message });
      toast.error(e.message || 'Không thể tạo thực đơn');
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await mealPlanService.getMealPlans();
      if (response.success && response.data) {
        dispatch({ type: 'SET_PLANS', payload: response.data });
      }
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', payload: e.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const fetchMealPlan = useCallback(async (id: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await mealPlanService.getMealPlanById(id);
      if (response.success && response.data) {
        dispatch({ type: 'SET_CURRENT_PLAN', payload: response.data });
        dispatch({ type: 'SET_CONFLICTS', payload: response.data.conflicts || [] });
      } else {
        dispatch({ type: 'SET_ERROR', payload: response.message || 'Failed to fetch meal plan' });
      }
    } catch (e: any) {
      dispatch({ type: 'SET_ERROR', payload: e.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const addRecipeToMealPlan = useCallback(
    async (data: AddRecipeToMealPlanRequest) => {
      if (!state.currentPlan) {
        toast.error('Vui lòng chọn thực đơn trước');
        return;
      }

      const tempItem: MealPlanItem = {
        id: Date.now(),
        mealPlanId: state.currentPlan.id,
        recipeId: data.recipeId,
        plannedDate: data.plannedDate,
        mealType: data.mealType,
        servings: data.servings || 2,
        notes: data.notes,
        recipe: {
          id: data.recipeId,
          recipeName: '',
          prepTime: 0,
          cookTime: 0,
          servings: data.servings || 2,
          difficulty: 'easy',
          ingredients: [],
        },
      };

      dispatch({ type: 'ADD_ITEM', payload: { item: tempItem, conflicts: [] } });
      dispatch({ type: 'SET_PENDING_CHANGES', payload: true });

      const operation = async () => {
        try {
          const response = await mealPlanService.addRecipeToMealPlan(state.currentPlan!.id, data);
          if (response.success && response.data) {
            dispatch({
              type: 'ADD_ITEM',
              payload: {
                item: response.data.item,
                conflicts: response.data.conflicts || [],
              },
            });
            dispatch({ type: 'SET_CONFLICTS', payload: response.data.conflicts || [] });
            toast.success('Đã thêm món ăn vào thực đơn!');
          }
        } catch (e: any) {
          dispatch({
            type: 'REMOVE_ITEM',
            payload: { itemId: tempItem.id, conflicts: [] },
          });
          toast.error(e.response?.data?.message || 'Không thể thêm món ăn');
          throw e;
        } finally {
          dispatch({ type: 'SET_PENDING_CHANGES', payload: false });
        }
      };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeWithOfflineSupport(operation);
      }, DEBOUNCE_MS);
    },
    [state.currentPlan, executeWithOfflineSupport]
  );

  const removeRecipeFromMealPlan = useCallback(
    async (itemId: number) => {
      if (!state.currentPlan) return;

      const removedItem = state.currentPlan.items.find((i) => i.id === itemId);

      dispatch({
        type: 'REMOVE_ITEM',
        payload: { itemId, conflicts: state.conflicts },
      });
      dispatch({ type: 'SET_PENDING_CHANGES', payload: true });

      const operation = async () => {
        try {
          const response = await mealPlanService.removeRecipeFromMealPlan(
            state.currentPlan!.id,
            itemId
          );
          if (response.success && response.data) {
            dispatch({ type: 'SET_CONFLICTS', payload: response.data.conflicts || [] });
            toast.success('Đã xóa món ăn khỏi thực đơn!');
          }
        } catch (e: any) {
          if (removedItem) {
            dispatch({
              type: 'ADD_ITEM',
              payload: { item: removedItem, conflicts: state.conflicts },
            });
          }
          toast.error(e.response?.data?.message || 'Không thể xóa món ăn');
          throw e;
        } finally {
          dispatch({ type: 'SET_PENDING_CHANGES', payload: false });
        }
      };

      executeWithOfflineSupport(operation);
    },
    [state.currentPlan, state.conflicts, executeWithOfflineSupport]
  );

  const updateMealPlanItem = useCallback(
    async (itemId: number, data: UpdateMealPlanItemRequest) => {
      if (!state.currentPlan) return;

      const updatedItems = state.currentPlan.items.map((i) =>
        i.id === itemId ? { ...i, ...data } : i
      );
      const tempPlan = { ...state.currentPlan, items: updatedItems as MealPlanItem[] };

      dispatch({ type: 'SET_CURRENT_PLAN', payload: tempPlan });
      dispatch({ type: 'SET_PENDING_CHANGES', payload: true });

      const operation = async () => {
        try {
          const response = await mealPlanService.updateMealPlanItem(
            state.currentPlan!.id,
            itemId,
            data
          );
          if (response.success && response.data) {
            dispatch({
              type: 'UPDATE_ITEM',
              payload: {
                item: response.data.item,
                conflicts: response.data.conflicts || [],
              },
            });
            dispatch({ type: 'SET_CONFLICTS', payload: response.data.conflicts || [] });
          }
        } catch (e: any) {
          toast.error(e.response?.data?.message || 'Không thể cập nhật');
          throw e;
        } finally {
          dispatch({ type: 'SET_PENDING_CHANGES', payload: false });
        }
      };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeWithOfflineSupport(operation);
      }, DEBOUNCE_MS);
    },
    [state.currentPlan, executeWithOfflineSupport]
  );

  const deleteMealPlan = useCallback(
    async (id: number) => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        const response = await mealPlanService.deleteMealPlan(id);
        if (response.success) {
          dispatch({ type: 'DELETE_PLAN', payload: id });
          toast.success('Đã xóa thực đơn!');
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể xóa thực đơn');
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    []
  );

  const updateMealPlanStatus = useCallback(
    async (status: 'active' | 'completed' | 'archived') => {
      if (!state.currentPlan) return;

      try {
        const response = await mealPlanService.updateMealPlanStatus(state.currentPlan.id, status);
        if (response.success && response.data) {
          dispatch({ type: 'UPDATE_PLAN', payload: response.data });
          toast.success('Cập nhật trạng thái thành công!');
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Không thể cập nhật trạng thái');
      }
    },
    [state.currentPlan]
  );

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const value: MealPlanContextType = {
    state,
    createMealPlan,
    fetchPlans,
    fetchMealPlan,
    addRecipeToMealPlan,
    removeRecipeFromMealPlan,
    updateMealPlanItem,
    deleteMealPlan,
    updateMealPlanStatus,
    clearError,
  };

  return <MealPlanContext.Provider value={value}>{children}</MealPlanContext.Provider>;
}

export function useMealPlan() {
  const context = useContext(MealPlanContext);
  if (context === undefined) {
    throw new Error('useMealPlan must be used within a MealPlanProvider');
  }
  return context;
}

export default MealPlanContext;
