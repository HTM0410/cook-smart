import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Admin from '../models/Admin';
import Comment from '../models/Comment';
import CommentLike from '../models/CommentLike';
import UserFavorite from '../models/UserFavorite';
import Recipe from '../models/Recipe';
import ChatSession from '../models/ChatSession';
import ChatMessage from '../models/ChatMessage';
import { processRAGQuery } from '../services/ragService';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  adminId?: number;
  user?: any;
  admin?: any;
  isAnonymous?: boolean;
}

class SocketServer {
  private io: SocketIOServer;
  private connectedUsers: Map<number, string> = new Map(); // userId -> socketId
  private lastFavoriteTime: Map<string, number> = new Map(); // "userId-recipeId" -> timestamp
  private lastRatingTime: Map<string, number> = new Map(); // "userId-recipeId" -> timestamp
  private lastCommentTime: Map<string, number> = new Map(); // "userId-recipeId" -> timestamp
  private userFavorites: Map<number, Set<number>> = new Map(); // userId -> Set of recipeIds
  private recipeFavoriteCounts: Map<number, number> = new Map(); // recipeId -> count
  private activeChatSessions: Map<string, { userId: number; sessionId: number }> = new Map(); // socketId -> chat session

  constructor(server: HttpServer) {
    console.log('🔌 SocketServer: constructor started');
    
    // Allow all origins in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const defaultOrigins = isDevelopment
      ? '*'
      : 'http://localhost:5173';
    
    const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || defaultOrigins)
      .split(',')
      .map(o => o.trim());
    
    console.log('🔌 SocketServer: creating SocketIOServer...');
    this.io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          
          // In development, allow any origin
          if (isDevelopment || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          
          callback(new Error('Not allowed by CORS'));
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    console.log('🔌 SocketServer: io created');

    // Initialize demo data
    this.initializeDemoData();

    console.log('🔌 SocketServer: setting up middleware...');
    this.setupMiddleware();
    console.log('🔌 SocketServer: setting up event handlers...');
    this.setupEventHandlers();
    console.log('🔌 SocketServer: constructor completed');
  }

  private initializeDemoData() {
    // Initialize demo recipe favorite counts
    this.recipeFavoriteCounts.set(1, 47); // Demo recipe ID 1 starts with 47 favorites
    console.log('🎯 Initialized demo favorite data');
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          // Allow anonymous connections for public features
          return next();
        }

        // Handle demo token
        if (token === 'demo_user_token_123') {
          socket.userId = 999; // Mock user ID
          socket.user = {
            id: 999,
            fullName: 'Demo User',
            email: 'demo@example.com'
          };
          this.connectedUsers.set(999, socket.id);
          console.log('🔌 Demo user connected:', socket.id);
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key') as any;
        
        if (decoded.userId) {
          const user = await User.findByPk(decoded.userId);
          if (user && user.status !== 'banned') {
            socket.userId = user.id;
            socket.user = user;
            this.connectedUsers.set(user.id, socket.id);
          }
        } else if (decoded.adminId) {
          const admin = await Admin.findByPk(decoded.adminId);
          if (admin) {
            socket.adminId = admin.id;
            socket.admin = admin;
          }
        }
        
        next();
      } catch (error: any) {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        // Allow demo connections even if JWT fails
        if (token === 'demo_user_token_123') {
          socket.userId = 999;
          socket.user = { id: 999, fullName: 'Demo User', email: 'demo@example.com' };
          this.connectedUsers.set(999, socket.id);
          console.log('🔌 Demo user connected:', socket.id);
          return next();
        }
        
        // Handle token expiration gracefully - allow anonymous connection
        if (error.name === 'TokenExpiredError') {
          console.log('🔓 JWT token expired - allowing anonymous WebSocket connection for public features');
          socket.isAnonymous = true;
          return next();
        }
        
        // Handle invalid token or missing token - allow anonymous connection
        if (error.name === 'JsonWebTokenError' || !token) {
          console.log('🔓 No valid token - allowing anonymous WebSocket connection for public features');
          socket.isAnonymous = true;
          return next();
        }
        
        // Reject other authentication failures
        console.error('❌ Socket authentication failed:', error.message);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`🔌 User connected: ${socket.id}${socket.userId ? ` (User: ${socket.userId})` : ''}${socket.adminId ? ` (Admin: ${socket.adminId})` : ''}`);

      // Join recipe room for real-time updates
      socket.on('join-recipe', (recipeId: number) => {
        const roomName = `recipe-${recipeId}`;
        socket.join(roomName);
        console.log(`📱 User ${socket.id} joined recipe room: ${roomName}`);
        
        // Send current favorite count and rating for this recipe
        this.sendRecipeStats(recipeId, roomName);
      });

      // Leave recipe room
      socket.on('leave-recipe', (recipeId: number) => {
        const roomName = `recipe-${recipeId}`;
        socket.leave(roomName);
        console.log(`📱 User ${socket.id} left recipe room: ${roomName}`);
      });

      // Handle favorite toggle (add/remove from favorites)
      socket.on('toggle-favorite', async (data: { recipeId: number }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required for favorites' });
          return;
        }

        try {
          const { recipeId } = data;
          const roomName = `recipe-${recipeId}`;
          const key = `${socket.userId}-${recipeId}`;
          
          // Rate limiting: prevent multiple favorites within 1 second
          const now = Date.now();
          const lastTime = this.lastFavoriteTime.get(key) || 0;
          if (now - lastTime < 1000) {
            console.log(`🚫 Rate limited: User ${socket.userId} favorite toggle too fast`);
            return;
          }
          this.lastFavoriteTime.set(key, now);
          
          // ✅ CHECK DATABASE for existing favorite
          const existingFavorite = await UserFavorite.findOne({
            where: {
              userId: socket.userId,
              recipeId: recipeId
            }
          });
          
          let isFavorited: boolean;
          
          if (existingFavorite) {
            // ✅ REMOVE from DATABASE
            await existingFavorite.destroy();
            isFavorited = false;
            console.log(`🗑️ User ${socket.userId} removed recipe ${recipeId} from favorites (DB)`);
            
            // Update memory cache
            const userFavorites = this.userFavorites.get(socket.userId);
            if (userFavorites) {
              userFavorites.delete(recipeId);
            }
          } else {
            // ✅ ADD to DATABASE
            await UserFavorite.create({
              userId: socket.userId,
              recipeId: recipeId
            });
            isFavorited = true;
            console.log(`💾 User ${socket.userId} added recipe ${recipeId} to favorites (DB)`);
            
            // Update memory cache
            let userFavorites = this.userFavorites.get(socket.userId);
            if (!userFavorites) {
              userFavorites = new Set();
              this.userFavorites.set(socket.userId, userFavorites);
            }
            userFavorites.add(recipeId);
          }
          
          // ✅ GET REAL COUNT from DATABASE
          const favoriteCount = await UserFavorite.count({
            where: { recipeId }
          });
          
          // Update memory cache
          this.recipeFavoriteCounts.set(recipeId, favoriteCount);
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('favorite-updated', {
            recipeId,
            userId: socket.userId,
            isFavorited,
            favoriteCount,
            timestamp: new Date().toISOString(),
          });

          console.log(`❤️ User ${socket.userId} ${isFavorited ? 'favorited' : 'unfavorited'} recipe ${recipeId} (DB count: ${favoriteCount})`);
        } catch (error) {
          console.error('❌ Error toggling favorite:', error);
          socket.emit('error', { message: 'Failed to toggle favorite' });
        }
      });

      // Handle rating submission
      socket.on('submit-rating', async (data: { recipeId: number; rating: number; comment?: string }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required for ratings' });
          return;
        }

        try {
          const { recipeId, rating, comment } = data;
          const roomName = `recipe-${recipeId}`;
          const key = `${socket.userId}-${recipeId}`;
          
          // Rate limiting: prevent multiple ratings within 2 seconds
          const now = Date.now();
          const lastTime = this.lastRatingTime.get(key) || 0;
          if (now - lastTime < 2000) {
            console.log(`🚫 Rate limited: User ${socket.userId} rating submission too fast`);
            return;
          }
          this.lastRatingTime.set(key, now);
          
          // Validate rating
          if (rating < 1 || rating > 5) {
            socket.emit('error', { message: 'Rating must be between 1 and 5' });
            return;
          }

          // Here you would implement the actual rating submission logic
          // For now, we'll simulate it
          const newAverageRating = 3.5 + Math.random() * 1.5; // Simulate rating between 3.5-5.0
          const newRatingCount = Math.floor(Math.random() * 100) + 10; // Simulate 10-110 ratings
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('rating-updated', {
            recipeId,
            userId: socket.userId,
            rating,
            comment,
            averageRating: newAverageRating,
            ratingCount: newRatingCount,
            timestamp: new Date().toISOString(),
          });

          console.log(`⭐ User ${socket.userId} rated recipe ${recipeId} with ${rating} stars`);
        } catch (error) {
          console.error('Error submitting rating:', error);
          socket.emit('error', { message: 'Failed to submit rating' });
        }
      });

      // Handle comment submission
      socket.on('submit-comment', async (data: { recipeId: number; content: string; parentId?: number }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required for comments' });
          return;
        }

        try {
          const { recipeId, content, parentId } = data;
          const roomName = `recipe-${recipeId}`;
          const key = `${socket.userId}-${recipeId}`;
          
          // Rate limiting: prevent multiple comments within 3 seconds
          const now = Date.now();
          const lastTime = this.lastCommentTime.get(key) || 0;
          if (now - lastTime < 3000) {
            console.log(`🚫 Rate limited: User ${socket.userId} comment submission too fast`);
            socket.emit('error', { message: 'Please wait before commenting again' });
            return;
          }
          this.lastCommentTime.set(key, now);
          
          // Validate content
          if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Comment content cannot be empty' });
            return;
          }
          
          if (content.length > 2000) {
            socket.emit('error', { message: 'Comment content too long (max 2000 characters)' });
            return;
          }
          
          // Create comment in database
          const comment = await Comment.createComment({
            recipeId,
            userId: socket.userId,
            parentId: parentId || null,
            content: content.trim()
          });
          
          // Get user info
          const user = await User.findByPk(socket.userId, {
            attributes: ['id', 'fullName', 'avatar']
          });
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('comment-added', {
            recipeId,
            comment: {
              id: comment.id,
              recipeId: comment.recipeId,
              userId: comment.userId,
              parentId: comment.parentId,
              content: comment.content,
              isEdited: comment.isEdited,
              likeCount: comment.likeCount,
              replyCount: comment.replyCount,
              createdAt: comment.createdAt,
              user: user ? {
                id: user.id,
                fullName: user.fullName,
                avatar: user.avatar
              } : null
            },
            timestamp: new Date().toISOString(),
          });

          console.log(`💬 User ${socket.userId} commented on recipe ${recipeId} (comment ID: ${comment.id})`);
        } catch (error) {
          console.error('Error submitting comment:', error);
          socket.emit('error', { message: 'Failed to submit comment' });
        }
      });
      
      // Handle comment edit
      socket.on('edit-comment', async (data: { commentId: number; content: string }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        try {
          const { commentId, content } = data;
          
          // Update comment
          const comment = await Comment.updateComment(commentId, socket.userId, content.trim());
          
          // Find recipe room
          const roomName = `recipe-${comment.recipeId}`;
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('comment-edited', {
            commentId: comment.id,
            recipeId: comment.recipeId,
            content: comment.content,
            isEdited: comment.isEdited,
            editedAt: comment.editedAt,
            timestamp: new Date().toISOString(),
          });

          console.log(`✏️ User ${socket.userId} edited comment ${commentId}`);
        } catch (error) {
          console.error('Error editing comment:', error);
          socket.emit('error', { message: 'Failed to edit comment' });
        }
      });
      
      // Handle comment delete
      socket.on('delete-comment', async (data: { commentId: number }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        try {
          const { commentId } = data;
          
          // Get comment before deletion to find recipe
          const comment = await Comment.findByPk(commentId);
          if (!comment) {
            socket.emit('error', { message: 'Comment not found' });
            return;
          }
          
          const recipeId = comment.recipeId;
          
          // Delete comment
          await Comment.deleteComment(commentId, socket.userId);
          
          // Find recipe room
          const roomName = `recipe-${recipeId}`;
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('comment-deleted', {
            commentId,
            recipeId,
            timestamp: new Date().toISOString(),
          });

          console.log(`🗑️ User ${socket.userId} deleted comment ${commentId}`);
        } catch (error) {
          console.error('Error deleting comment:', error);
          socket.emit('error', { message: 'Failed to delete comment' });
        }
      });
      
      // Handle comment like
      socket.on('like-comment', async (data: { commentId: number }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        try {
          const { commentId } = data;
          
          // Toggle like
          const result = await CommentLike.toggleLike(commentId, socket.userId);
          
          // Get updated comment
          const comment = await Comment.findByPk(commentId);
          if (!comment) {
            socket.emit('error', { message: 'Comment not found' });
            return;
          }
          
          // Find recipe room
          const roomName = `recipe-${comment.recipeId}`;
          
          // Broadcast to all users in the recipe room
          this.io.to(roomName).emit('comment-liked', {
            commentId,
            recipeId: comment.recipeId,
            userId: socket.userId,
            isLiked: result.isLiked,
            likeCount: comment.likeCount,
            timestamp: new Date().toISOString(),
          });

          console.log(`👍 User ${socket.userId} ${result.isLiked ? 'liked' : 'unliked'} comment ${commentId}`);
        } catch (error) {
          console.error('Error liking comment:', error);
          socket.emit('error', { message: 'Failed to like comment' });
        }
      });

      // Handle get favorite status
      socket.on('get-favorite-status', async (data: { recipeId: number }) => {
        if (!socket.userId) {
          socket.emit('error', { message: 'Authentication required' });
          return;
        }

        try {
          const { recipeId } = data;
          
          // ✅ CHECK DATABASE instead of memory
          const existingFavorite = await UserFavorite.findOne({
            where: {
              userId: socket.userId,
              recipeId: recipeId
            }
          });
          
          const isFavorited = !!existingFavorite;
          
          // ✅ GET REAL COUNT from DATABASE
          const favoriteCount = await UserFavorite.count({
            where: { recipeId }
          });
          
          // Update memory cache
          if (isFavorited) {
            let userFavorites = this.userFavorites.get(socket.userId);
            if (!userFavorites) {
              userFavorites = new Set();
              this.userFavorites.set(socket.userId, userFavorites);
            }
            userFavorites.add(recipeId);
          }
          this.recipeFavoriteCounts.set(recipeId, favoriteCount);
          
          socket.emit('favorite-status', {
            recipeId,
            userId: socket.userId,
            isFavorited,
            favoriteCount,
            timestamp: new Date().toISOString(),
          });

          console.log(`📊 User ${socket.userId} requested favorite status for recipe ${recipeId}: ${isFavorited} (DB count: ${favoriteCount})`);
        } catch (error) {
          console.error('❌ Error getting favorite status:', error);
          socket.emit('error', { message: 'Failed to get favorite status' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
        }
        // Clean up chat session
        this.activeChatSessions.delete(socket.id);
        console.log(`🔌 User disconnected: ${socket.id}`);
      });

      // ========== CHAT EVENTS ==========

      // Handle join chat session
      socket.on('chat:join', async (data: { sessionId?: number }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('chat:error', { message: 'Authentication required for chat' });
          return;
        }

        try {
          let session;

          if (data.sessionId) {
            // Join existing session
            session = await ChatSession.findOne({
              where: { id: data.sessionId, userId: socket.userId },
            });

            if (!session) {
              socket.emit('chat:error', { message: 'Session not found' });
              return;
            }
          } else {
            // Create new session
            session = await ChatSession.create({
              userId: socket.userId,
              sessionTitle: 'New Chat',
            });

            // Create initial greeting
            await ChatMessage.create({
              sessionId: session.id,
              role: 'assistant',
              content: 'Xin chào! Tôi là trợ lý nấu ăn của CookSmart. Bạn có thể hỏi tôi về công thức nấu ăn, nguyên liệu, hoặc gợi ý món ăn nhé!',
              metadata: {},
            });
          }

          // Join socket room
          const roomName = `chat-${session.id}`;
          socket.join(roomName);

          // Store active session
          this.activeChatSessions.set(socket.id, {
            userId: socket.userId,
            sessionId: session.id,
          });

          // Get messages
          const messages = await ChatMessage.findAll({
            where: { sessionId: session.id },
            order: [['createdAt', 'ASC']],
          });

          socket.emit('chat:joined', {
            sessionId: session.id,
            sessionTitle: session.sessionTitle,
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          });

          console.log(`💬 User ${socket.userId} joined chat session ${session.id}`);
        } catch (error) {
          console.error('❌ Error joining chat:', error);
          socket.emit('chat:error', { message: 'Failed to join chat' });
        }
      });

      // Handle chat message
      socket.on('chat:message', async (data: { sessionId: number; content: string }) => {
        if (!socket.userId || socket.isAnonymous) {
          socket.emit('chat:error', { message: 'Authentication required for chat' });
          return;
        }

        try {
          const { sessionId, content } = data;

          // Verify session ownership
          const session = await ChatSession.findOne({
            where: { id: sessionId, userId: socket.userId },
          });

          if (!session) {
            socket.emit('chat:error', { message: 'Session not found' });
            return;
          }

          // Save user message
          const userMessage = await ChatMessage.create({
            sessionId,
            role: 'user',
            content: content.trim(),
            metadata: {},
          });

          // Update session timestamp using touch
          await ChatSession.update(
            { updatedAt: new Date() },
            { where: { id: sessionId } }
          );

          // Emit user message immediately
          const roomName = `chat-${sessionId}`;
          this.io.to(roomName).emit('chat:message', {
            id: userMessage.id,
            sessionId,
            role: 'user',
            content: userMessage.content,
            createdAt: userMessage.createdAt,
          });

          // Emit typing indicator
          socket.to(roomName).emit('chat:typing', { role: 'assistant', isTyping: true });

          // Get conversation history for context
          const history = await ChatMessage.findAll({
            where: { sessionId },
            order: [['createdAt', 'ASC']],
            limit: 20,
          });

          // Convert to Gemini format
          const conversationHistory = history
            .filter((m) => m.id !== userMessage.id)
            .map((m) => ({
              role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
              content: m.content,
            }));

          // Process RAG query
          const ragResponse = await processRAGQuery(content.trim(), conversationHistory);

          // Save AI response
          const aiMessage = await ChatMessage.create({
            sessionId,
            role: 'assistant',
            content: ragResponse.text,
            metadata: { sources: ragResponse.sources },
          });

          // Update session title if new
          if (session.sessionTitle === 'New Chat') {
            session.sessionTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            await session.save();
          }

          // Emit AI response
          this.io.to(roomName).emit('chat:message', {
            id: aiMessage.id,
            sessionId,
            role: 'assistant',
            content: aiMessage.content,
            createdAt: aiMessage.createdAt,
            sources: ragResponse.sources,
          });

          // Stop typing indicator
          this.io.to(roomName).emit('chat:typing', { role: 'assistant', isTyping: false });

          console.log(`💬 Chat message processed for session ${sessionId}`);
        } catch (error) {
          console.error('❌ Error processing chat message:', error);
          socket.to(`chat-${data.sessionId}`).emit('chat:typing', { role: 'assistant', isTyping: false });
          socket.emit('chat:error', { message: 'Failed to process message' });
        }
      });

      // Handle typing indicator
      socket.on('chat:typing', (data: { sessionId: number; isTyping: boolean }) => {
        if (!socket.userId) return;

        const roomName = `chat-${data.sessionId}`;
        socket.to(roomName).emit('chat:typing', {
          role: 'user',
          isTyping: data.isTyping,
        });
      });

      // Handle leave chat
      socket.on('chat:leave', (data: { sessionId: number }) => {
        const roomName = `chat-${data.sessionId}`;
        socket.leave(roomName);
        this.activeChatSessions.delete(socket.id);
        console.log(`💬 User left chat session ${data.sessionId}`);
      });

    });
  }

  private async sendRecipeStats(recipeId: number, roomName: string) {
    try {
      // Here you would fetch actual stats from database
      // For now, we'll simulate it
      const stats = {
        recipeId,
        favoriteCount: Math.floor(Math.random() * 100) + 10,
        averageRating: 3.5 + Math.random() * 1.5,
        ratingCount: Math.floor(Math.random() * 100) + 10,
        commentCount: Math.floor(Math.random() * 50) + 5,
      };

      this.io.to(roomName).emit('recipe-stats', stats);
    } catch (error) {
      console.error('Error sending recipe stats:', error);
    }
  }

  // Public methods for external use
  public getIO(): SocketIOServer {
    return this.io;
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public broadcastToRecipe(recipeId: number, event: string, data: any) {
    const roomName = `recipe-${recipeId}`;
    this.io.to(roomName).emit(event, data);
  }

  public broadcastToUser(userId: number, event: string, data: any) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }
}

export default SocketServer;
