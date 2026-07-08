import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import Admin from '../models/Admin'
import { generateToken, generateRefreshToken } from '../middleware/auth'
import { ConflictError, UnauthorizedError, BadRequestError } from '../utils/errors'

// User Registration
export const registerUser = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { email, password, fullName, phone } = req.body

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ where: { email } })
    if (existingUser) {
      throw new ConflictError('Email already registered', 'EMAIL_EXISTS')
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10')
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Tạo user mới
    const user = await User.create({
      email,
      password: password, // Model sẽ tự hash password trong hook
      fullName,
      status: 'active',
      role: 'user'
    })

    // Tạo tokens
    const token = generateToken({ userId: user.id, email: user.email })
    const refreshToken = generateRefreshToken({ userId: user.id })

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt
        },
        token,
        refreshToken
      }
    })
  } catch (error) {
    next(error)
  }
}

// User Login
export const loginUser = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { email, password } = req.body

    // Tìm user
    const user = await User.findOne({ where: { email } })
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Kiểm tra status
    if (user.status === 'banned') {
      throw new UnauthorizedError('Account has been banned', 'ACCOUNT_BANNED')
    }

    // Kiểm tra password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS')
    }

    // Tạo tokens
    const token = generateToken({ userId: user.id, email: user.email })
    const refreshToken = generateRefreshToken({ userId: user.id })

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          lastLoginAt: new Date()
        },
        token,
        refreshToken
      }
    })
  } catch (error) {
    next(error)
  }
}

// Admin Login
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body

    // Tìm admin
    const admin = await Admin.findOne({ where: { username } })
    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      })
      return
    }

    // Kiểm tra password
    const isValidPassword = await bcrypt.compare(password, admin.password)
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      })
      return
    }

    // Tạo tokens
    const token = generateToken({ adminId: admin.id, username: admin.username })
    const refreshToken = generateRefreshToken({ adminId: admin.id })

    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          email: `${admin.username}@cooksmart.local`,
          fullName: admin.username,
          role: 'admin',
          adminRole: admin.role,
          isAdmin: true,
          createdAt: admin.createdAt
        },
        token,
        refreshToken
      }
    })
  } catch (error) {
    console.error('Admin login error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during admin login'
    })
  }
}

// Get Current User Profile
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    })
  } catch (error) {
    console.error('Get current user error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

// Get Current Admin Profile
export const getCurrentAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = req.admin
    const user = req.user

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          email: user?.email || `${admin.username}@cooksmart.local`,
          fullName: user?.fullName || admin.username,
          role: 'admin',
          adminRole: admin.role,
          isAdmin: true,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt
        }
      }
    })
  } catch (error) {
    console.error('Get current admin error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}

// Refresh Token
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      })
      return
    }

    // Verify refresh token
    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'super_secret_key')

    let user = null
    let admin = null

    if (decoded.userId) {
      user = await User.findByPk(decoded.userId)
      if (!user || user.status === 'banned') {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        })
        return
      }
    } else if (decoded.adminId) {
      admin = await Admin.findByPk(decoded.adminId)
      if (!admin) {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        })
        return
      }
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      })
      return
    }

    // Generate new tokens
    const newToken = user 
      ? generateToken({ userId: user.id, email: user.email })
      : generateToken({ adminId: admin!.id, username: admin!.username })
    
    const newRefreshToken = user
      ? generateRefreshToken({ userId: user.id })
      : generateRefreshToken({ adminId: admin!.id })

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    })
  }
}

// Logout (client-side token removal)
export const logout = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Logout successful'
  })
}

// Forgot Password
export const forgotPassword = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { email } = req.body
    const user = await User.findOne({ where: { email } })
    
    if (!user) {
      // Trả về success để không leak thông tin email có tồn tại hay không
      res.json({ 
        success: true, 
        message: 'If email exists, password reset instructions have been sent' 
      })
      return
    }

    // TODO: Implement email sending logic
    // 1. Generate reset token
    // 2. Store token in database with expiry
    // 3. Send email with reset link
    console.log(`Password reset requested for: ${email}`)
    
    res.json({ 
      success: true, 
      message: 'If email exists, password reset instructions have been sent' 
    })
  } catch (error) {
    next(error)
  }
}

// Reset Password
export const resetPassword = async (req: Request, res: Response, next: any): Promise<void> => {
  try {
    const { token, newPassword } = req.body
    
    if (!token || !newPassword) {
      throw new BadRequestError('Token and new password are required', 'MISSING_FIELDS')
    }

    // TODO: Implement token validation logic
    // 1. Verify token is valid and not expired
    // 2. Find user by token
    // 3. Update password
    // 4. Invalidate token
    console.log(`Password reset attempted with token: ${token}`)
    
    res.json({ 
      success: true, 
      message: 'Password has been reset successfully' 
    })
  } catch (error) {
    next(error)
  }
}

// Change Password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = req.user

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      })
      return
    }

    // Update password (model sẽ tự hash trong hook)
    await user.update({ password: newPassword })

    res.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    })
  }
}
