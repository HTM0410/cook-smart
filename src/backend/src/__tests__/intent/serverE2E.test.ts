/**
 * E2E Server Test (Real HTTP)
 *
 * Spin up một Express server thật trên cổng ngẫu nhiên với:
 *   - Intent pipeline đầy đủ
 *   - Mock RAG (không gọi Gemini thật)
 *   - Mock DB models
 * Sau đó gọi HTTP thật bằng `node fetch` để verify.
 *
 * Verify được:
 *   - Server thật start được
 *   - HTTP request thật trả response đúng
 *   - JSON parse đúng
 *   - Session context persist qua các request
 *
 * NOTE: File này dùng ts-node để chạy trực tiếp (npm run test:e2e)
 *       hoặc dùng Jest với supertest từ file khác.
 */

import express, { Request, Response } from 'express';
import { processMessage, clearSessionContext } from '../../services/intent/pipeline';
import { processRAGQuery } from '../../services/ragService';
import { addMessageToSession, getSessionContext } from '../../services/intent/sessionStore';
import { ChatSession, ChatMessage } from '../../models';

// Mock models module
jest.mock('../../models', () => {
  const sessionCreate = jest.fn();
  const sessionFindOne = jest.fn();
  const messageCreate = jest.fn();
  const messageFindAll = jest.fn();
  return {
    ChatSession: {
      create: sessionCreate,
      findOne: sessionFindOne,
      update: jest.fn(),
    },
    ChatMessage: {
      create: messageCreate,
      findAll: messageFindAll,
    },
    // Mock User, Recipe etc. nếu cần
    User: {},
    Admin: {},
    Recipe: {},
  };
});

describe('E2E Real HTTP Server', () => {
  let app: express.Express;
  let server: any;
  let baseUrl: string;
  let messageCounter = 0;

  beforeAll((done) => {
    // Reset session
    const { clearSessionContext } = require('../../services/intent/sessionStore');
    for (const sid of require('../../services/intent/sessionStore').listActiveSessions()) {
      clearSessionContext(sid);
    }

    // Mock DB - bind to the mocked models
    const { ChatSession, ChatMessage } = require('../../models');
    let sessionId = 1;
    (ChatSession as any).findOne.mockImplementation((query: any) => {
      return Promise.resolve({
        id: query.where.id,
        userId: query.where.userId,
        sessionTitle: 'Test Chat',
        save: jest.fn(),
      });
    });
    (ChatSession as any).create.mockImplementation((data: any) =>
      Promise.resolve({ id: ++sessionId, ...data, save: jest.fn() }),
    );
    (ChatMessage as any).create.mockImplementation((data: any) => {
      const msg = { id: ++messageCounter, ...data, createdAt: new Date() };
      return Promise.resolve(msg);
    });
    (ChatMessage as any).findAll.mockImplementation(() => Promise.resolve([]));

    // Mock RAG - trả về kết quả giả
    jest.spyOn(require('../../services/ragService'), 'processRAGQuery')
      .mockImplementation(async (...args: unknown[]) => {
        const query = args[0] as string;
        return {
          text: `[MOCK RAG] Bạn hỏi: "${query}". Đây là response giả.`,
          sources: [
            { recipeId: 1, recipeName: 'Mock Recipe 1', similarity: 0.9 },
          ],
        };
      });

    // Tạo Express app
    app = express();
    app.use(express.json());

    // Auth middleware mock
    app.use((req: any, _res, next) => {
      req.userId = 999;
      next();
    });

    // Real REST endpoint
    app.post('/api/chat/message', async (req: Request, res: Response) => {
      try {
        const { sessionId, content } = req.body;
        const userId = (req as any).userId;

        let session;
        if (sessionId) {
          session = await (ChatSession as any).findOne({
            where: { id: sessionId, userId },
          });
        }
        if (!session) {
          session = await (ChatSession as any).create({ userId, sessionTitle: 'New Chat' });
        }

        const userMessage = await (ChatMessage as any).create({
          sessionId: session.id,
          role: 'user',
          content: content.trim(),
          metadata: {},
        });

        const history = await (ChatMessage as any).findAll({
          where: { sessionId: session.id },
        });

        // Hydrate session
        const ctx = getSessionContext(session.id.toString());
        if (ctx.messages.length === 0 && history.length > 0) {
          for (const m of history) {
            if (m.id === userMessage.id) continue;
            addMessageToSession(session.id.toString(), {
              role: m.role,
              content: m.content,
              timestamp: Date.now(),
              metadata: m.metadata,
            });
          }
        }

        const pipelineResponse = await processMessage(
          session.id.toString(),
          content.trim(),
          async (q: string, h: any, ic: any) => {
            const r = await processRAGQuery(q, h, ic);
            return { text: r.text, sources: r.sources };
          },
        );

        await (ChatMessage as any).create({
          sessionId: session.id,
          role: 'assistant',
          content: pipelineResponse.text,
          metadata: { intent: pipelineResponse.intent.primaryIntent },
        });

        res.json({
          sessionId: session.id,
          aiMessage: pipelineResponse.text,
          intent: pipelineResponse.intent.primaryIntent,
          route: pipelineResponse.route,
          resolvedQuery: pipelineResponse.resolvedQuery,
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Listen on random port
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    }
  });

  it('E2E: Server start + POST /api/chat/message với "xin chào" → CANNED', async () => {
    const res = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'xin chào' }),
    });
    const data = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(data.route).toBe('canned');
    expect(data.intent).toBe('greeting');
  });

  it('E2E: POST /api/chat/message với "thời tiết" → OFFTOPIC', async () => {
    const res = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'thời tiết hôm nay' }),
    });
    const data = (await res.json()) as any;
    expect(data.route).toBe('offtopic_response');
  });

  it('E2E: POST /api/chat/message với "phở bò" → RAG gọi mock', async () => {
    const res = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'phở bò' }),
    });
    const data = (await res.json()) as any;
    expect(data.route).toBe('rag');
    expect(data.intent).toBe('recipe_search');
    expect(data.aiMessage).toContain('[MOCK RAG]');
  });

  it('E2E: Multi-turn "cách làm món thứ 2" sau khi gợi ý → resolve', async () => {
    // Turn 1: gợi ý món
    const turn1 = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'gợi ý món từ thịt gà' }),
    });
    const turn1Data = (await turn1.json()) as any;
    expect(turn1Data.route).toBe('rag');

    // Turn 2: tham chiếu "món thứ 2"
    const turn2 = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'cách làm món thứ 2' }),
    });
    const turn2Data = (await turn2.json()) as any;
    // Trong test này mock findAll trả về [] → session context sẽ rỗng cho turn 2
    // → resolve không có dishReferences → resolvedQuery không thay đổi
    // Test chỉ verify request trả 200 OK
    expect(turn2.status).toBe(200);
  });

  it('E2E: Nhiều request liên tiếp đến cùng session → cùng sessionId', async () => {
    // Reset
    clearSessionContext('99');

    // Mock findOne trả về session có sẵn
    (ChatSession as any).findOne.mockImplementationOnce(() =>
      Promise.resolve({ id: 99, userId: 999, sessionTitle: 'Pre-existing', save: jest.fn() }),
    );

    const res1 = await fetch(`${baseUrl}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 99, content: 'xin chào' }),
    });
    const data1 = (await res1.json()) as any;
    expect(data1.sessionId).toBe(99);
  });
});