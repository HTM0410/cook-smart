/**
 * Integration test cho Chat REST API với Intent Pipeline
 *
 * Test flow:
 *   1. POST /api/chat/sessions → tạo session
 *   2. POST /api/chat/message → gửi message qua intent pipeline
 *   3. Verify response có intent, route, aiMessage
 *   4. Test conversation context (turn 2 với reference)
 *
 * Sử dụng Supertest + Jest. Mock DB models và RAG service.
 */

// Mock models
const mockChatSession = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockChatMessage = {
  create: jest.fn(),
  findAll: jest.fn(),
};

const mockRAGQuery = jest.fn();

jest.mock('../../models/ChatSession', () => mockChatSession);
jest.mock('../../models/ChatMessage', () => mockChatMessage);
jest.mock('../../services/ragService', () => ({
  processRAGQuery: mockRAGQuery,
  generateSuggestedQuestions: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../middleware/auth', () => ({
  authenticateChatParticipant: (req: any, _res: any, next: any) => {
    req.userId = 999; // Mock user
    next();
  },
}));

// @ts-nocheck - skip type check; supertest types
import express from 'express';
import request from 'supertest';
import chatRoutes from '../../routes/chatRoutes';

describe('Chat REST API Integration với Intent Pipeline', () => {
  let app: express.Express;
  let messageCounter = 0;
  let sessionCounter = 0;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
  });

  beforeEach(async () => {
    messageCounter = 0;
    sessionCounter = 0;
    jest.clearAllMocks();
    // Reset session store để mỗi test isolated
    const { clearSessionContext, listActiveSessions } = await import('../../services/intent/sessionStore');
    for (const sid of listActiveSessions()) {
      clearSessionContext(sid);
    }
  });

  // Helper: Mock ChatSession.findOne
  const mockSession = (id: number, userId = 999) => {
    const session = {
      id,
      userId,
      sessionTitle: 'Test Chat',
      save: jest.fn(),
      update: jest.fn(),
    };
    mockChatSession.findOne.mockResolvedValue(session);
    mockChatSession.create.mockImplementation((data: any) =>
      Promise.resolve({ id: ++sessionCounter, ...data }),
    );
    return session;
  };

  // Helper: Mock ChatMessage.create (giả lập DB insert)
  const mockMessage = (role: 'user' | 'assistant', content: string, metadata: any = {}) => {
    const msg = {
      id: ++messageCounter,
      sessionId: 1,
      role,
      content,
      metadata,
      createdAt: new Date(),
    };
    return msg;
  };

  it('POST /api/chat/sessions → tạo session thành công', async () => {
    mockChatSession.create.mockResolvedValue({
      id: 1,
      userId: 999,
      sessionTitle: 'New Chat',
      createdAt: new Date(),
    });
    mockChatMessage.create.mockResolvedValue({});

    const res = await request(app)
      .post('/api/chat/sessions')
      .send({ title: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(1);
  });

  it('POST /api/chat/message với "xin chào" → CANNED route, không gọi RAG', async () => {
    const session = mockSession(1);
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: 'xin chào' });

    expect(res.status).toBe(200);
    expect(res.body.data.route).toBe('canned');
    expect(res.body.data.intent).toBe('greeting');
    expect(mockRAGQuery).not.toHaveBeenCalled();
  });

  it('POST /api/chat/message với "thời tiết" → OFFTOPIC', async () => {
    const session = mockSession(1);
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: 'thời tiết hôm nay' });

    expect(res.body.data.route).toBe('offtopic_response');
    expect(res.body.data.intent).toBe('offtopic');
    expect(mockRAGQuery).not.toHaveBeenCalled();
  });

  it('POST /api/chat/message với "phở bò" → RAG, gọi processRAGQuery', async () => {
    const session = mockSession(1);
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);
    mockRAGQuery.mockResolvedValue({
      text: 'Gợi ý: 1. Phở bò tái, 2. Phở bò viên',
      sources: [{ recipeId: 1, recipeName: 'Phở bò', similarity: 0.9 }],
    });

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: 'phở bò' });

    expect(res.body.data.route).toBe('rag');
    expect(res.body.data.intent).toBe('recipe_search');
    expect(mockRAGQuery).toHaveBeenCalledTimes(1);
    // Verify RAG được gọi với resolvedQuery
    const call = mockRAGQuery.mock.calls[0];
    expect(call[0]).toContain('pho bo'); // normalized
  });

  it('POST /api/chat/message với "phở bò bao nhiêu calo" → NUTRITION → DB_LOOKUP', async () => {
    const session = mockSession(1);
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);
    mockRAGQuery.mockResolvedValue({
      text: 'Phở bò chứa khoảng 450 kcal/bát',
      sources: [],
    });

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: 'phở bò bao nhiêu calo' });

    expect(res.body.data.route).toBe('db_lookup');
    expect(res.body.data.intent).toBe('nutrition');
    expect(mockRAGQuery).toHaveBeenCalled();
  });

  it('Multi-turn: "cách làm món thứ 2" với history → resolve reference', async () => {
    // Reset session store để test isolated
    const { clearSessionContext } = await import('../../services/intent/sessionStore');
    clearSessionContext('100');

    const session = mockSession(100);
    // Mock create user message
    let userMsgId = 1000;
    mockChatMessage.create.mockImplementation((data: any) => {
      const id = ++userMsgId;
      return Promise.resolve({
        id,
        sessionId: 100,
        role: data.role,
        content: data.content,
        metadata: data.metadata,
        createdAt: new Date(),
      });
    });
    // Mock history với assistant message có dishReferences
    mockChatMessage.findAll.mockResolvedValue([
      {
        id: 999,
        sessionId: 100,
        role: 'assistant',
        content: '1. Gà kho, 2. Gà xào, 3. Gà nướng',
        metadata: { dishReferences: ['Gà kho', 'Gà xào', 'Gà nướng'] },
        createdAt: new Date(),
      },
    ]);
    mockRAGQuery.mockResolvedValue({
      text: 'Hướng dẫn làm Gà xào...',
      sources: [],
    });

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 100, content: 'cách làm món thứ 2' });

    expect(res.body.data.route).toBe('db_lookup');
    expect(res.body.data.intent).toBe('recipe_detail');
    // Verify RAG được gọi với resolvedQuery chứa "Gà xào"
    const callArgs = mockRAGQuery.mock.calls[0];
    expect(callArgs[0]).toContain('Gà xào');
  });

  it('POST /api/chat/message với "cách làm phở bò" → RECIPE_DETAIL → DB_LOOKUP', async () => {
    const session = mockSession(1);
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);
    mockRAGQuery.mockResolvedValue({
      text: 'Bước 1: Sơ chế nguyên liệu...',
      sources: [{ recipeId: 1, recipeName: 'Phở bò' }],
    });

    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: 'cách làm phở bò' });

    expect(res.status).toBe(200);
    expect(res.body.data.route).toBe('db_lookup');
    expect(res.body.data.intent).toBe('recipe_detail');
  });

  it('POST /api/chat/message với empty content → 400', async () => {
    const res = await request(app)
      .post('/api/chat/message')
      .send({ sessionId: 1, content: '' });

    expect(res.status).toBe(400);
  });

  it('POST /api/chat/message với no sessionId → tự tạo session mới', async () => {
    mockChatSession.findOne.mockResolvedValue(null);
    mockChatSession.create.mockResolvedValue({
      id: 99,
      userId: 999,
      sessionTitle: 'New Chat',
      save: jest.fn(),
    });
    mockChatMessage.create.mockImplementation((data: any) =>
      Promise.resolve(mockMessage(data.role, data.content, data.metadata)),
    );
    mockChatMessage.findAll.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/chat/message')
      .send({ content: 'xin chào' });

    expect(res.status).toBe(200);
    expect(res.body.data.sessionId).toBe(99);
    expect(res.body.data.route).toBe('canned');
  });
});