/**
 * Chat Controller
 * Handles chat-related API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import ChatSession from '../models/ChatSession';
import ChatMessage from '../models/ChatMessage';
import { processRAGQuery, generateSuggestedQuestions } from '../services/ragService';

export interface AuthenticatedRequest extends Request {
  userId?: number;
  adminId?: number;
}

/**
 * Create a new chat session
 */
export async function createSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const { title } = req.body;

    const session = await ChatSession.create({
      userId,
      sessionTitle: title || 'New Chat',
    });

    // Create initial system message
    await ChatMessage.create({
      sessionId: session.id,
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý nấu ăn của CookSmart. Bạn có thể hỏi tôi về công thức nấu ăn, nguyên liệu, hoặc gợi ý món ăn nhé!',
      metadata: {},
    });

    res.status(201).json({
      message: 'Chat session created',
      data: {
        id: session.id,
        sessionTitle: session.sessionTitle,
        createdAt: session.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all chat sessions for a user
 */
export async function getSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const sessions = await ChatSession.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']],
      attributes: ['id', 'sessionTitle', 'createdAt', 'updatedAt'],
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          attributes: ['id', 'role', 'content', 'createdAt'],
          order: [['createdAt', 'ASC']],
          limit: 1,
        },
      ],
    });

    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      sessionTitle: session.sessionTitle,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      preview: session.messages?.[0]?.content?.substring(0, 100) || '',
    }));

    res.json({
      message: 'Chat sessions retrieved',
      data: formattedSessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific chat session with messages
 */
export async function getSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const sessionId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (isNaN(sessionId)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
      include: [
        {
          model: ChatMessage,
          as: 'messages',
          order: [['createdAt', 'ASC']],
          attributes: ['id', 'role', 'content', 'metadata', 'createdAt'],
        },
      ],
    });

    if (!session) {
      res.status(404).json({ message: 'Chat session not found' });
      return;
    }

    res.json({
      message: 'Chat session retrieved',
      data: {
        id: session.id,
        sessionTitle: session.sessionTitle,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: session.messages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a chat session
 */
export async function deleteSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const sessionId = parseInt(req.params.id, 10);

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (isNaN(sessionId)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      res.status(404).json({ message: 'Chat session not found' });
      return;
    }

    // Delete will cascade to messages due to foreign key
    await session.destroy();

    res.json({
      message: 'Chat session deleted',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update session title
 */
export async function updateSessionTitle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const sessionId = parseInt(req.params.id, 10);
    const { title } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (isNaN(sessionId)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      res.status(404).json({ message: 'Chat session not found' });
      return;
    }

    session.sessionTitle = title || 'New Chat';
    await session.save();

    res.json({
      message: 'Session title updated',
      data: {
        id: session.id,
        sessionTitle: session.sessionTitle,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a message and get AI response (REST fallback)
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const sessionId = parseInt(req.body.sessionId, 10);
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (!content || content.trim().length === 0) {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    // Find or create session
    let session;
    if (!isNaN(sessionId)) {
      session = await ChatSession.findOne({
        where: { id: sessionId, userId },
      });
    }

    if (!session) {
      session = await ChatSession.create({
        userId,
        sessionTitle: 'New Chat',
      });
    }

    // Save user message
    const userMessage = await ChatMessage.create({
      sessionId: session.id,
      role: 'user',
      content: content.trim(),
      metadata: {},
    });

    // Update session timestamp using touch
    await ChatSession.update(
      { updatedAt: new Date() },
      { where: { id: session.id } }
    );

    // Get conversation history for context
    const history = await ChatMessage.findAll({
      where: { sessionId: session.id },
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
      sessionId: session.id,
      role: 'assistant',
      content: ragResponse.text,
      metadata: { sources: ragResponse.sources },
    });

    // Update session title if it's a new chat
    if (session.sessionTitle === 'New Chat' && content.length > 0) {
      session.sessionTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      await session.save();
    }

    res.json({
      message: 'Message sent',
      data: {
        sessionId: session.id,
        userMessage: {
          id: userMessage.id,
          role: 'user',
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        aiMessage: {
          id: aiMessage.id,
          role: 'assistant',
          content: aiMessage.content,
          createdAt: aiMessage.createdAt,
          sources: ragResponse.sources,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get suggested questions
 */
export async function getSuggestedQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const questions = await generateSuggestedQuestions();
    res.json({
      message: 'Suggested questions retrieved',
      data: questions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chat history for a session
 */
export async function getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    const sessionId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    if (!userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (isNaN(sessionId)) {
      res.status(400).json({ message: 'Invalid session ID' });
      return;
    }

    const session = await ChatSession.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      res.status(404).json({ message: 'Chat session not found' });
      return;
    }

    const messages = await ChatMessage.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
      offset,
      limit,
    });

    res.json({
      message: 'Messages retrieved',
      data: messages,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  createSession,
  getSessions,
  getSession,
  deleteSession,
  updateSessionTitle,
  sendMessage,
  getSuggestedQuestions,
  getMessages,
};
