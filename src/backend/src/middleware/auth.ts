import { Request, Response, NextFunction } from 'express'
import jwt, { SignOptions } from 'jsonwebtoken'
import User from '../models/User'
import Admin from '../models/Admin'

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any
      admin?: any
    }
  }
}

// JWT Secret từ environment
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key'

// Middleware xác thực JWT cho User
export const authenticateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      })
      return
    }

    // Support demo token for testing
    if (token === 'demo_user_token_123') {
      const demoUser = await User.findOne({ where: { email: 'demo@example.com' } })
      if (demoUser) {
        req.user = demoUser
        next()
        return
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const user = await User.findByPk(decoded.userId)
    
    if (!user) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      })
      return
    }

    if (user.status === 'banned') {
      res.status(403).json({ 
        success: false, 
        message: 'Account has been banned.' 
      })
      return
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    })
  }
}

// Middleware xác thực JWT cho Admin
export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      })
      return
    }

    // Support demo token for testing
    if (token === 'demo_user_token_123') {
      const demoUser = await User.findOne({ where: { email: 'demo@example.com' } })
      if (demoUser) {
        req.user = demoUser
        next()
        return
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any
    const admin = await Admin.findByPk(decoded.adminId)
    
    if (!admin) {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid token. Admin not found.' 
      })
      return
    }

    req.admin = admin
    next()
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    })
  }
}

// Middleware kiểm tra quyền admin
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // Allow demo user to access admin routes for testing
  if (req.user && req.user.email === 'demo@example.com') {
    next()
    return
  }
  
  if (!req.admin) {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required.' 
    })
    return
  }
  next()
}

// Middleware kiểm tra quyền superadmin
export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.admin || req.admin.role !== 'superadmin') {
    res.status(403).json({ 
      success: false, 
      message: 'Super admin access required.' 
    })
    return
  }
  next()
}

// Middleware xác thực tùy chọn (không bắt buộc)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any
      
      if (decoded.userId) {
        const user = await User.findByPk(decoded.userId)
        if (user && user.status !== 'banned') {
          req.user = user
        }
      } else if (decoded.adminId) {
        const admin = await Admin.findByPk(decoded.adminId)
        if (admin) {
          req.admin = admin
        }
      }
    }
    
    next()
  } catch (error) {
    // Nếu token không hợp lệ, vẫn tiếp tục nhưng không set user/admin
    next()
  }
}

// Utility function để tạo JWT token
export const generateToken = (payload: any, expiresIn: string = '24h') => {
  const options: SignOptions = { expiresIn: expiresIn as any }
  return jwt.sign(payload, JWT_SECRET, options)
}

// Utility function để tạo refresh token
export const generateRefreshToken = (payload: any) => {
  const options: SignOptions = { expiresIn: '30d' as any }
  return jwt.sign(payload, JWT_SECRET, options)
}
