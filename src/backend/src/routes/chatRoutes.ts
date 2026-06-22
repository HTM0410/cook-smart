/**
 * Chat Routes
 * API routes for chat functionality
 */

import { Router } from 'express';
import {
  createSession,
  getSessions,
  getSession,
  deleteSession,
  updateSessionTitle,
  sendMessage,
  getSuggestedQuestions,
  getMessages,
} from '../controllers/chatController';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/chat/sessions
 * @desc    Create a new chat session
 * @access  Private
 */
router.post('/sessions', authenticateUser, createSession);

/**
 * @route   GET /api/chat/sessions
 * @desc    Get all chat sessions for current user
 * @access  Private
 */
router.get('/sessions', authenticateUser, getSessions);

/**
 * @route   GET /api/chat/sessions/:id
 * @desc    Get a specific chat session with messages
 * @access  Private
 */
router.get('/sessions/:id', authenticateUser, getSession);

/**
 * @route   DELETE /api/chat/sessions/:id
 * @desc    Delete a chat session
 * @access  Private
 */
router.delete('/sessions/:id', authenticateUser, deleteSession);

/**
 * @route   PATCH /api/chat/sessions/:id
 * @desc    Update session title
 * @access  Private
 */
router.patch('/sessions/:id', authenticateUser, updateSessionTitle);

/**
 * @route   GET /api/chat/sessions/:id/messages
 * @desc    Get messages for a chat session
 * @access  Private
 */
router.get('/sessions/:id/messages', authenticateUser, getMessages);

/**
 * @route   POST /api/chat/message
 * @desc    Send a message and get AI response (REST fallback)
 * @access  Private
 */
router.post('/message', authenticateUser, sendMessage);

/**
 * @route   GET /api/chat/suggestions
 * @desc    Get suggested questions
 * @access  Public
 */
router.get('/suggestions', getSuggestedQuestions);

export default router;
