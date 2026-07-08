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
import { authenticateChatParticipant } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/chat/sessions
 * @desc    Create a new chat session
 * @access  Private
 */
router.post('/sessions', authenticateChatParticipant, createSession);

/**
 * @route   GET /api/chat/sessions
 * @desc    Get all chat sessions for current user
 * @access  Private
 */
router.get('/sessions', authenticateChatParticipant, getSessions);

/**
 * @route   GET /api/chat/sessions/:id
 * @desc    Get a specific chat session with messages
 * @access  Private
 */
router.get('/sessions/:id', authenticateChatParticipant, getSession);

/**
 * @route   DELETE /api/chat/sessions/:id
 * @desc    Delete a chat session
 * @access  Private
 */
router.delete('/sessions/:id', authenticateChatParticipant, deleteSession);

/**
 * @route   PATCH /api/chat/sessions/:id
 * @desc    Update session title
 * @access  Private
 */
router.patch('/sessions/:id', authenticateChatParticipant, updateSessionTitle);

/**
 * @route   GET /api/chat/sessions/:id/messages
 * @desc    Get messages for a chat session
 * @access  Private
 */
router.get('/sessions/:id/messages', authenticateChatParticipant, getMessages);

/**
 * @route   POST /api/chat/message
 * @desc    Send a message and get AI response (REST fallback)
 * @access  Private
 */
router.post('/message', authenticateChatParticipant, sendMessage);

/**
 * @route   GET /api/chat/suggestions
 * @desc    Get suggested questions
 * @access  Public
 */
router.get('/suggestions', getSuggestedQuestions);

export default router;
