/**
 * Gemini Service using LangChain
 * Handles all interactions with Google Gemini API through LangChain
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponse {
  text: string;
  sourceDocuments?: any[];
}

let chatModel: ChatGoogleGenerativeAI | null = null;

/**
 * Get Chat Model instance (singleton)
 */
export function getChatModel(): ChatGoogleGenerativeAI {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  if (!chatModel) {
    chatModel = new ChatGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
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
  
  return chatModel;
}

/**
 * Get text embedding - using direct API call via fetch
 * Note: LangChain's Google GenAI doesn't have direct embedContent, so we use the API directly
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              model: 'models/embedding-001',
              content: {
                parts: [{ text }],
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as any;
    const embedding = data.embeddings?.[0]?.values || [];
    
    return {
      embedding,
      model: 'embedding-001',
    };
  } catch (error: any) {
    console.error('Error getting embedding from Gemini:', error.message);
    throw new Error(`Failed to get embedding: ${error.message}`);
  }
}

/**
 * Get multiple embeddings in batch
 */
export async function getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (texts.length === 0) {
    return [];
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: 'models/embedding-001',
            content: {
              parts: [{ text }],
            },
          })),
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as any;
    
    return data.embeddings.map((emb: any) => ({
      embedding: emb.values || [],
      model: 'embedding-001',
    }));
  } catch (error: any) {
    console.error('Error getting batch embeddings from Gemini:', error.message);
    throw new Error(`Failed to get batch embeddings: ${error.message}`);
  }
}

/**
 * Send chat message to Gemini using LangChain with prompt template
 */
export async function sendChatMessage(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  systemInstruction?: string
): Promise<ChatResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const model = getChatModel();
    const outputParser = new StringOutputParser();
    
    // Build prompt
    const promptMessages: any[] = [];
    
    if (systemInstruction) {
      promptMessages.push(SystemMessagePromptTemplate.fromTemplate(systemInstruction));
    }
    
    // Add conversation history (except last message)
    for (const msg of messages.slice(0, -1)) {
      if (msg.role === 'model') {
        promptMessages.push({ role: 'ai', content: msg.content });
      } else {
        promptMessages.push({ role: 'human', content: msg.content });
      }
    }
    
    promptMessages.push(HumanMessagePromptTemplate.fromTemplate('{input}'));
    
    const prompt = ChatPromptTemplate.fromMessages(promptMessages);
    
    // Create chain
    const chain = prompt.pipe(model).pipe(outputParser);
    
    // Get last message
    const lastMessage = messages[messages.length - 1];
    
    // Invoke chain
    const text = await chain.invoke({ input: lastMessage.content });
    
    return {
      text,
    };
  } catch (error: any) {
    console.error('Error sending chat message via LangChain:', error.message);
    throw new Error(`Failed to send chat message: ${error.message}`);
  }
}

/**
 * Stream chat message response from Gemini using LangChain
 */
export async function streamChatMessage(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  systemInstruction?: string,
  onChunk?: (text: string) => void
): Promise<ChatResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const model = getChatModel();
    const outputParser = new StringOutputParser();
    
    // Build prompt
    const promptMessages: any[] = [];
    
    if (systemInstruction) {
      promptMessages.push(SystemMessagePromptTemplate.fromTemplate(systemInstruction));
    }
    
    for (const msg of messages.slice(0, -1)) {
      if (msg.role === 'model') {
        promptMessages.push({ role: 'ai', content: msg.content });
      } else {
        promptMessages.push({ role: 'human', content: msg.content });
      }
    }
    
    promptMessages.push(HumanMessagePromptTemplate.fromTemplate('{input}'));
    
    const prompt = ChatPromptTemplate.fromMessages(promptMessages);
    
    // Create chain
    const chain = prompt.pipe(model).pipe(outputParser);
    
    // Get last message
    const lastMessage = messages[messages.length - 1];
    
    // Stream invoke
    let fullText = '';
    const stream = await chain.stream({ input: lastMessage.content });
    
    for await (const chunk of stream) {
      fullText += chunk;
      onChunk?.(chunk);
    }
    
    return {
      text: fullText,
    };
  } catch (error: any) {
    console.error('Error streaming chat message via LangChain:', error.message);
    throw new Error(`Failed to stream chat message: ${error.message}`);
  }
}

/**
 * Check if Gemini API is configured and working
 */
export async function checkGeminiHealth(): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    return false;
  }

  try {
    await getEmbedding('health check');
    return true;
  } catch {
    return false;
  }
}

export default {
  getEmbedding,
  getBatchEmbeddings,
  sendChatMessage,
  streamChatMessage,
  checkGeminiHealth,
  getChatModel,
};
