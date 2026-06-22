import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  compressImage,
  validateImageFile,
  createImageHash,
  fileToBase64,
  getMimeType,
  yoloService,
  saveDetectionHistory,
  DetectedIngredient,
  DbMatchedIngredient,
} from '../../services/yoloService';

interface IngredientDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ingredients: string[]) => void;
}

type ModalStep = 'upload' | 'detecting' | 'review' | 'error';

interface DetectionState {
  success: boolean;
  detected: boolean;
  ingredients: DetectedIngredient[];
  dbMatched: DbMatchedIngredient[];
  missing: string[];
  totalDetected: number;
  totalInDatabase: number;
}

const IngredientDetectionModal: React.FC<IngredientDetectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [step, setStep] = useState<ModalStep>('upload');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Detection state
  const [originalIngredients, setOriginalIngredients] = useState<string[]>([]);
  const [userIngredients, setUserIngredients] = useState<string[]>([]);
  const [newIngredient, setNewIngredient] = useState('');
  const [detectionState, setDetectionState] = useState<DetectionState | null>(null);
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [previewUrl]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setSelectedImage(null);
      setPreviewUrl(null);
      setError(null);
      setOriginalIngredients([]);
      setUserIngredients([]);
      setDetectionState(null);
    }
  }, [isOpen]);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || 'File không hợp lệ');
      return;
    }

    setSelectedImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    } else {
      setError('Vui lòng chọn file hình ảnh');
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleCameraCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      
      // Wait for video to load
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      // Create canvas and capture
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      
      // Stop camera
      stream.getTracks().forEach(track => track.stop());
      
      // Convert to file
      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          handleFileSelect(file);
        }
      }, 'image/jpeg', 0.8);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập.');
    }
  }, [handleFileSelect]);

  const handleDetect = useCallback(async () => {
    if (!selectedImage) return;

    setStep('detecting');
    setError(null);

    try {
      // Compress image before sending
      const compressed = await compressImage(selectedImage, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.8,
      });

      console.log(`[Detection] Image compressed: ${compressed.width}x${compressed.height}, ${(compressed.size / 1024).toFixed(1)}KB`);

      // Call detection API
      const result = await yoloService.detectIngredients(compressed.base64, {
        mimeType: getMimeType(selectedImage),
      });

      setDetectionState(result);

      if (!result.detected || result.ingredients.length === 0) {
        setStep('error');
        setError('Không tìm thấy nguyên liệu nào trong ảnh.');
        return;
      }

      // Set ingredients for review
      const ingredientNames = result.ingredients.map(i => i.name);
      setOriginalIngredients(ingredientNames);
      setUserIngredients([...ingredientNames]);
      setStep('review');
    } catch (err: any) {
      console.error('[Detection] Error:', err);
      setStep('error');
      
      if (err.message?.includes('timeout') || err.message?.includes('TIMEOUT')) {
        setError('Dịch vụ nhận diện đang gián đoạn. Vui lòng thử lại sau hoặc nhập nguyên liệu bằng tay.');
      } else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('connect')) {
        setError('Không thể kết nối dịch vụ nhận diện. Vui lòng kiểm tra kết nối mạng.');
      } else {
        setError(err.message || 'Có lỗi xảy ra khi nhận diện. Vui lòng thử lại.');
      }
    }
  }, [selectedImage]);

  const handleAddIngredient = useCallback(() => {
    if (!newIngredient.trim()) return;
    
    const parts = newIngredient.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const newItems = parts.filter(p => !userIngredients.includes(p));
    
    if (newItems.length > 0) {
      setUserIngredients(prev => [...prev, ...newItems]);
    }
    setNewIngredient('');
  }, [newIngredient, userIngredients]);

  const handleRemoveIngredient = useCallback((ingredient: string) => {
    setUserIngredients(prev => prev.filter(i => i !== ingredient));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (userIngredients.length === 0) {
      setError('Vui lòng thêm ít nhất một nguyên liệu');
      return;
    }

    // Check if user modified the list
    const wasModified = JSON.stringify(originalIngredients.sort()) !== JSON.stringify(userIngredients.sort());

    // Save history if modified (async, don't block UI)
    if (wasModified && selectedImage) {
      setIsSavingHistory(true);
      try {
        const imageHash = createImageHash(selectedImage);
        await saveDetectionHistory({
          imageHash,
          originalIngredients,
          finalIngredients: userIngredients,
          wasModified: true,
        });
        console.log('[Detection] History saved for admin review');
      } catch (err) {
        console.error('[Detection] Failed to save history:', err);
      } finally {
        setIsSavingHistory(false);
      }
    }

    onConfirm(userIngredients);
    onClose();
  }, [userIngredients, originalIngredients, selectedImage, onConfirm, onClose]);

  const handleRetry = useCallback(() => {
    setStep('upload');
    setSelectedImage(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
    setDetectionState(null);
    setOriginalIngredients([]);
    setUserIngredients([]);
  }, [previewUrl]);

  const handleBack = useCallback(() => {
    setStep('upload');
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Nhận diện nguyên liệu từ ảnh
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Tải lên hoặc chụp ảnh nguyên liệu để hệ thống tự động nhận diện.
              </p>

              {/* Upload area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => {
                  console.log('[Upload] Empty area clicked');
                  if (fileInputRef.current && !previewUrl) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                className={`
                  relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  onClick={(e) => {
                    console.log('[Upload] Input clicked');
                    (e.target as HTMLInputElement).value = '';
                  }}
                  className="hidden"
                />
                
                {previewUrl ? (
                  <div className="space-y-4 cursor-pointer" onClick={() => {
                    console.log('[Upload] Preview area clicked');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      fileInputRef.current.click();
                    }
                  }}>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-h-64 mx-auto rounded-lg object-contain"
                    />
                    <p className="text-sm text-gray-500">Click để chọn ảnh khác</p>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Kéo thả ảnh vào đây hoặc <span className="text-primary font-medium">click để chọn</span>
                    </p>
                    <p className="text-sm text-gray-400">Hỗ trợ JPG, PNG, WebP (tối đa 10MB)</p>
                  </>
                )}
              </div>

              {/* Camera button */}
              <div className="flex items-center justify-center">
                <button
                  onClick={handleCameraCapture}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Mở camera</span>
                </button>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDetect}
                  disabled={!selectedImage}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Nhận diện
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Detecting */}
          {step === 'detecting' && (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 mx-auto border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Đang phân tích hình ảnh...
              </p>
              <p className="text-sm text-gray-500">Vui lòng chờ trong giây lát</p>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                {/* Image preview */}
                {previewUrl && (
                  <div className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                
                {/* Detection stats */}
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">
                    Đã nhận diện <span className="font-semibold text-primary">{detectionState?.totalDetected || 0}</span> nguyên liệu
                    {detectionState && detectionState.totalInDatabase > 0 && (
                      <span className="text-gray-400"> ({detectionState.totalInDatabase} có trong database)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    Bạn có thể sửa, thêm hoặc xóa nguyên liệu trước khi tìm kiếm
                  </p>
                </div>
              </div>

              {/* Ingredients tags */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nguyên liệu đã nhận diện
                </label>
                
                <div className="flex flex-wrap gap-2 min-h-[48px] p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                  {userIngredients.map((ingredient, index) => (
                    <span
                      key={`${ingredient}-${index}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm border border-gray-200 dark:border-gray-600 group hover:border-primary transition-colors"
                    >
                      {ingredient}
                      <button
                        onClick={() => handleRemoveIngredient(ingredient)}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors opacity-50 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  
                  {userIngredients.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Chưa có nguyên liệu nào</p>
                  )}
                </div>
              </div>

              {/* Add new ingredient */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thêm nguyên liệu khác
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddIngredient();
                      }
                    }}
                    placeholder="VD: hành, tỏi..."
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    onClick={handleAddIngredient}
                    disabled={!newIngredient.trim()}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Modified notice */}
              {JSON.stringify(originalIngredients.sort()) !== JSON.stringify(userIngredients.sort()) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Bạn đã sửa đổi danh sách nguyên liệu. Thay đổi sẽ được gửi cho Admin duyệt.
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleBack}
                  className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Quay lại
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={userIngredients.length === 0}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingHistory && (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Bắt đầu tìm kiếm ({userIngredients.length})
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Error */}
          {step === 'error' && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Không tìm thấy nguyên liệu nào trong ảnh
                </p>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  {error || 'Có thể ảnh không rõ ràng, góc chụp không phù hợp, hoặc không chứa đồ ăn. Vui lòng thử lại với ảnh khác.'}
                </p>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Thử ảnh khác
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IngredientDetectionModal;
