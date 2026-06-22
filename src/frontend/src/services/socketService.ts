/**
 * Socket Service
 * Socket.io client wrapper for real-time chat and favorites
 */

import { io, Socket } from 'socket.io-client';

interface ChatEvents {
  'chat:joined': (data: {
    sessionId: number;
    sessionTitle: string;
    messages: Array<{
      id: number;
      role: string;
      content: string;
      createdAt: string;
    }>;
  }) => void;
  'chat:message': (data: {
    id: number;
    sessionId: number;
    role: string;
    content: string;
    createdAt: string;
    sources?: any[];
  }) => void;
  'chat:typing': (data: { role: string; isTyping: boolean }) => void;
  'chat:error': (data: { message: string }) => void;
  'favorite-updated': (data: {
    recipeId: number;
    userId: number;
    isFavorited: boolean;
    favoriteCount: number;
    timestamp: string;
  }) => void;
  'favorite-status': (data: {
    recipeId: number;
    userId: number;
    isFavorited: boolean;
    favoriteCount: number;
    timestamp: string;
  }) => void;
  'recipe-stats': (data: {
    recipeId: number;
    favoriteCount: number;
    averageRating: number;
    ratingCount: number;
    commentCount: number;
  }) => void;
  'notification': (data: any) => void;
}

type EventCallback<T extends keyof ChatEvents> = ChatEvents[T];

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Connect to socket server
   */
  connect(token?: string): void {
    if (this.socket?.connected) {
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.emit('connected', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.emit('disconnected', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.emit('error', { error: error.message });
    });

    // Chat events
    this.socket.on('chat:joined', (data) => this.emit('chat:joined', data));
    this.socket.on('chat:message', (data) => this.emit('chat:message', data));
    this.socket.on('chat:typing', (data) => this.emit('chat:typing', data));
    this.socket.on('chat:error', (data) => this.emit('chat:error', data));

    // Favorite events
    this.socket.on('favorite-updated', (data) => this.emit('favorite-updated', data));
    this.socket.on('favorite-status', (data) => this.emit('favorite-status', data));
    this.socket.on('recipe-stats', (data) => this.emit('recipe-stats', data));
    this.socket.on('notification', (data) => this.emit('notification', data));
  }

  /**
   * Disconnect from socket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Join a chat session
   */
  joinChat(sessionId?: number): void {
    if (!this.socket?.connected) {
      console.error('❌ Socket not connected');
      return;
    }
    this.socket.emit('chat:join', { sessionId });
  }

  /**
   * Send a chat message
   */
  sendMessage(sessionId: number, content: string): void {
    if (!this.socket?.connected) {
      console.error('❌ Socket not connected');
      return;
    }
    this.socket.emit('chat:message', { sessionId, content });
  }

  /**
   * Send typing indicator
   */
  sendTyping(sessionId: number, isTyping: boolean): void {
    if (!this.socket?.connected) return;
    this.socket.emit('chat:typing', { sessionId, isTyping });
  }

  /**
   * Leave chat session
   */
  leaveChat(sessionId: number): void {
    if (!this.socket?.connected) return;
    this.socket.emit('chat:leave', { sessionId });
  }

  /**
   * Join a recipe room for real-time favorite updates
   */
  joinRecipeRoom(recipeId: number): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot join recipe room');
      return;
    }
    this.socket.emit('recipe:join', { recipeId });
  }

  /**
   * Leave a recipe room
   */
  leaveRecipeRoom(recipeId: number): void {
    if (!this.socket?.connected) return;
    this.socket.emit('recipe:leave', { recipeId });
  }

  /**
   * Get favorite status for a recipe
   */
  getFavoriteStatus(recipeId: number): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot get favorite status');
      return;
    }
    this.socket.emit('favorite:status', { recipeId });
  }

  /**
   * Toggle favorite for a recipe
   */
  toggleFavorite(recipeId: number): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot toggle favorite');
      return;
    }
    this.socket.emit('favorite:toggle', { recipeId });
  }

  /**
   * Subscribe to an event
   */
  on<T extends keyof ChatEvents>(event: T, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from an event
   */
  off<T extends keyof ChatEvents>(event: T, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event (internal use)
   */
  private emit<T extends keyof ChatEvents>(event: string, data: any): void {
    this.listeners.get(event)?.forEach((callback) => {
      callback(data);
    });
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;
