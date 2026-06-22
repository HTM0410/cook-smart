import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';

// Check if Cloudinary is properly configured
const isCloudinaryConfigured = (): boolean => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  
  return !!(
    cloudName && 
    apiKey && 
    apiSecret && 
    cloudName !== 'demo' && 
    cloudName !== 'your_cloud_name' &&
    apiKey !== 'demo' && 
    apiKey !== 'your_api_key' &&
    apiSecret !== 'demo' && 
    apiSecret !== 'your_api_secret'
  );
};

// Only configure Cloudinary if credentials are valid
if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
  console.log('☁️ Cloudinary configured successfully');
} else {
  console.log('💾 Cloudinary not configured - using local storage');
}

export { cloudinary };

// Helper function to upload avatar
export const uploadAvatar = async (file: Express.Multer.File): Promise<string> => {
  try {
    // Validate file exists
    if (!file || !file.path) {
      throw new Error('File path is missing');
    }

    if (!fs.existsSync(file.path)) {
      throw new Error(`File does not exist at path: ${file.path}`);
    }

    console.log('📁 File path exists:', file.path);
    console.log('📁 File size:', fs.statSync(file.path).size, 'bytes');
    console.log('📁 File filename:', file.filename);

    if (isCloudinaryConfigured()) {
      console.log('☁️ Uploading to Cloudinary...');
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'food-suggest/avatars',
        public_id: `avatar-${Date.now()}`,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto' }
        ]
      });
      
      console.log('✅ Avatar uploaded to Cloudinary:', result.secure_url);
      
      // Delete temp file after successful Cloudinary upload
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      return result.secure_url;
    } else {
      console.log('💾 Saving locally (Cloudinary not configured)...');
      
      // File is already saved by multer, just return the URL
      const filename = file.filename;
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const avatarUrl = `${baseUrl}/uploads/${filename}`;
      
      console.log('✅ Avatar URL:', avatarUrl);
      console.log('📁 File saved at:', file.path);
      
      // Verify file exists after multer saved it
      if (!fs.existsSync(file.path)) {
        throw new Error('File was not saved properly by multer');
      }
      
      return avatarUrl;
    }
  } catch (error: any) {
    console.error('❌ Avatar upload error:', error);
    console.error('❌ Error message:', error.message);
    throw new Error(`Failed to upload avatar: ${error.message}`);
  }
};

// Helper function to delete avatar
export const deleteAvatar = async (avatarUrl: string): Promise<void> => {
  try {
    // Extract public_id from URL
    const publicId = avatarUrl.split('/').pop()?.split('.')[0];
    if (publicId) {
      await cloudinary.uploader.destroy(`food-suggest/avatars/${publicId}`);
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    // Don't throw error for delete operations
  }
};
