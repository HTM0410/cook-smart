/**
 * LangChain RAG Chain
 * Creates RAG chains using LangChain
 */

import { createRetriever } from './retriever';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { Document } from '@langchain/core/documents';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS?.split(',')[0] || '';

/**
 * System prompt for the recipe chatbot
 */
const SYSTEM_PROMPT = `Bạn là một trợ lý nấu ăn thông minh của ứng dụng CookSmart. 
Nhiệm vụ của bạn là giúp người dùng:
1. Tìm kiếm và gợi ý công thức nấu ăn
2. Hướng dẫn cách chế biến món ăn
3. Trả lời các câu hỏi về nguyên liệu và cách nấu
4. Đề xuất món ăn phù hợp với khẩu vị và điều kiện của người dùng

Hãy trả lời bằng tiếng Việt, thân thiện và nhiệt tình.
Chỉ đề xuất các công thức có trong dữ liệu của chúng tôi.
Nếu không có thông tin, hãy nói rõ là bạn không biết.

Khi đề cập đến công thức, hãy bao gồm:
- Tên công thức
- Thành phần chính
- Thời gian nấu ước tính
- Link đến công thức đầy đủ nếu có thể`;

/**
 * Get Chat Model instance for LangChain
 */
function getChatModel(): ChatGoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình');
  }
  
  return new ChatGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
    temperature: 0.7,
    maxOutputTokens: 2048,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
  });
}

/**
 * Format documents for context
 */
function formatDocuments(docs: Document[]): string {
  return docs.map((doc, i) => `[Tài liệu ${i + 1}]:\n${doc.pageContent}`).join('\n\n');
}

/**
 * Create a basic RAG chain for recipe queries
 */
export function createRAGChain() {
  const retriever = createRetriever({ k: 5, minSimilarity: 0.5 });
  const model = getChatModel();
  const outputParser = new StringOutputParser();

  const prompt = ChatPromptTemplate.fromTemplate(`
Dựa trên ngữ cảnh sau đây, hãy trả lời câu hỏi của người dùng một cách chi tiết và hữu ích.

Ngữ cảnh:
{context}

Câu hỏi: {question}

Hãy trả lời bằng tiếng Việt, và chỉ sử dụng thông tin từ ngữ cảnh được cung cấp.`);
  
  const chain = RunnableSequence.from([
    {
      context: async (input: { question: string }) => {
        const docs = await retriever.getRelevantDocuments(input.question);
        return formatDocuments(docs);
      },
      question: (input: { question: string }) => input.question,
    },
    prompt,
    model,
    outputParser,
  ]);

  return chain;
}

/**
 * Create a conversational RAG chain with chat history
 */
export function createConversationalRAGChain() {
  const retriever = createRetriever({ k: 5, minSimilarity: 0.5 });
  const model = getChatModel();
  const outputParser = new StringOutputParser();

  const prompt = ChatPromptTemplate.fromTemplate(`
${SYSTEM_PROMPT}

Lịch sử hội thoại:
{chat_history}

Ngữ cảnh liên quan:
{context}

Câu hỏi hiện tại: {question}

Hãy trả lời dựa trên ngữ cảnh và lịch sử hội thoại.`);
  
  const chain = RunnableSequence.from([
    {
      context: async (input: { question: string; chat_history?: string }) => {
        const docs = await retriever.getRelevantDocuments(input.question);
        return formatDocuments(docs);
      },
      chat_history: (input: { chat_history?: string }) => input.chat_history || 'Không có lịch sử hội thoại',
      question: (input: { question: string }) => input.question,
    },
    prompt,
    model,
    outputParser,
  ]);

  return chain;
}

/**
 * Execute a RAG query with the chain
 */
export async function executeRAGQuery(
  question: string,
  chatHistory?: string[]
): Promise<{ answer: string; sourceDocuments: Document[] }> {
  const chain = createRAGChain();
  
  try {
    const answer = await chain.invoke({ question });
    
    const retriever = createRetriever({ k: 5 });
    const docs = await retriever.getRelevantDocuments(question);
    
    return {
      answer,
      sourceDocuments: docs,
    };
  } catch (error) {
    console.error('Error executing RAG query:', error);
    throw error;
  }
}

export default {
  createRAGChain,
  createConversationalRAGChain,
  executeRAGQuery,
};
