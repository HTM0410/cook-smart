/**
 * Chat Service
 * API calls for chat functionality
 */

import axios from 'axios';
import api from '../config/api';

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  sources?: Array<{
    recipeId: number;
    recipeName: string;
    content: string;
    similarity: number;
  }>;
}

export interface ChatSession {
  id: number;
  sessionTitle: string;
  preview?: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

const chatApi = {
  /**
   * Create a new chat session
   */
  createSession: async (title?: string): Promise<ChatSession> => {
    const response = await api.post('/chat/sessions', { title });
    return response.data.data;
  },

  /**
   * Get all chat sessions
   */
  getSessions: async (): Promise<ChatSession[]> => {
    const response = await api.get('/chat/sessions');
    return response.data.data;
  },

  /**
   * Get a specific chat session with messages
   */
  getSession: async (sessionId: number): Promise<ChatSession> => {
    const response = await api.get(`/chat/sessions/${sessionId}`);
    return response.data.data;
  },

  /**
   * Delete a chat session
   */
  deleteSession: async (sessionId: number): Promise<void> => {
    await api.delete(`/chat/sessions/${sessionId}`);
  },

  /**
   * Update session title
   */
  updateSessionTitle: async (sessionId: number, title: string): Promise<void> => {
    await api.patch(`/chat/sessions/${sessionId}`, { title });
  },

  /**
   * Send a message and get AI response
   */
  sendMessage: async (sessionId: number, content: string): Promise<{
    sessionId: number;
    userMessage: ChatMessage;
    aiMessage: ChatMessage;
  }> => {
    const response = await api.post('/chat/message', {
      sessionId,
      content,
    });
    return response.data.data;
  },

  /**
   * Get messages for a session
   */
  getMessages: async (sessionId: number, limit?: number, offset?: number): Promise<ChatMessage[]> => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    
    const response = await api.get(`/chat/sessions/${sessionId}/messages?${params}`);
    return response.data.data;
  },

  /**
   * Get suggested questions
   */
  getSuggestions: async (): Promise<string[]> => {
    const response = await api.get('/chat/suggestions');
    return response.data.data;
  },
};

export default chatApi;
