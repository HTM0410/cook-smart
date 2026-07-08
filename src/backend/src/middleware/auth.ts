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
      userId?: number
      adminId?: number
    }
  }
}

// JWT Secret từ environment
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key'

export const getOrCreateAdminChatUser = async (admin: Admin): Promise<User> => {
  const email = `admin-${admin.id}@cooksmart.local.com`
  const existingUser = await User.findOne({ where: { email } })

  if (existingUser) {
    return existingUser
  }

  const maxUserId = await User.max('id') as number | null

  return User.create({
    id: (maxUserId || 0) + 1,
    email,
    fullName: admin.username,
    password: `AdminChat${admin.id}123`,
    role: 'user',
    status: 'active',
  })
}

const attachAdminAsUser = async (req: Request, admin: Admin): Promise<void> => {
  const adminUser = await getOrCreateAdminChatUser(admin)
  req.admin = admin
  req.adminId = admin.id
  req.user = adminUser
  req.userId = adminUser.id
}

const attachUserAdmin = (req: Request, user: User): void => {
  req.admin = {
    id: user.id,
    username: user.email,
    role: 'moderator',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
  req.adminId = user.id
}

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
        req.userId = demoUser.id
        next()
        return
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any

    if (decoded.adminId) {
      const admin = await Admin.findByPk(decoded.adminId)
      if (!admin) {
        res.status(401).json({
          success: false,
          message: 'Invalid token. Admin not found.'
        })
        return
      }

      await attachAdminAsUser(req, admin)
      next()
      return
    }

    if (!decoded.userId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token.'
      })
      return
    }

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
    req.userId = user.id
    if (user.role === 'admin') {
      attachUserAdmin(req, user)
    }
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
        req.userId = demoUser.id
        next()
        return
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any

    if (decoded.adminId) {
      const admin = await Admin.findByPk(decoded.adminId)
      if (!admin) {
        res.status(401).json({
          success: false,
          message: 'Invalid token. Admin not found.'
        })
        return
      }

      await attachAdminAsUser(req, admin)
      next()
      return
    }

    if (decoded.userId) {
      const user = await User.findByPk(decoded.userId)
      if (!user || user.status === 'banned') {
        res.status(401).json({
          success: false,
          message: 'Invalid token. User not found.'
        })
        return
      }

      if (user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Admin access required.'
        })
        return
      }

      req.user = user
      req.userId = user.id
      attachUserAdmin(req, user)
      next()
      return
    }

    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    })
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    })
  }
}

export const authenticateUserOrAdmin = authenticateUser

export const authenticateAdminOrUserAdmin = authenticateAdmin

// Middleware xác thực cho chatbot: user dùng trực tiếp, admin được map sang user nội bộ để lưu chat_sessions.user_id
export const authenticateChatParticipant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')
    
    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      })
      return
    }

    if (token === 'demo_user_token_123') {
      const demoUser = await User.findOne({ where: { email: 'demo@example.com' } })
      if (demoUser) {
        req.user = demoUser
        req.userId = demoUser.id
        next()
        return
      }
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any

    if (decoded.userId) {
      const user = await User.findByPk(decoded.userId)
      if (!user || user.status === 'banned') {
        res.status(401).json({ success: false, message: 'Invalid token. User not found.' })
        return
      }

      req.user = user
      req.userId = user.id
      if (user.role === 'admin') {
        attachUserAdmin(req, user)
      }
      next()
      return
    }

    if (decoded.adminId) {
      const admin = await Admin.findByPk(decoded.adminId)
      if (!admin) {
        res.status(401).json({ success: false, message: 'Invalid token. Admin not found.' })
        return
      }

      await attachAdminAsUser(req, admin)
      next()
      return
    }

    res.status(401).json({ success: false, message: 'Invalid token.' })
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    })
  }
}

// Middleware xác thực cho tính năng yêu thích.
// User dùng trực tiếp, admin được map sang user nội bộ để vẫn lưu được user_favorites.user_id.
export const authenticateFavoriteParticipant = authenticateChatParticipant

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
