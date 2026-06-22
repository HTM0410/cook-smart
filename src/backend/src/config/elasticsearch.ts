import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

// Elasticsearch configuration
const elasticsearchConfig = {
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_AUTH ? {
    username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
    password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
  } : undefined,
  requestTimeout: 30000,
  maxRetries: 3,
  resurrectStrategy: 'ping' as const,
  compression: true,
};

// Create Elasticsearch client instance with fallback
let elasticsearchClient: Client | null = null;

// Check if Elasticsearch should be enabled
const ELASTICSEARCH_ENABLED = process.env.ELASTICSEARCH_ENABLED === 'true';

if (ELASTICSEARCH_ENABLED) {
  try {
    elasticsearchClient = new Client(elasticsearchConfig);
    console.log('🔍 Elasticsearch client initialized');
  } catch (error) {
    console.warn('⚠️ Elasticsearch initialization failed, using fallback');
    elasticsearchClient = null;
  }
} else {
  console.log('📝 Elasticsearch disabled, using fallback autocomplete');
}

// Index names
export const ELASTICSEARCH_INDICES = {
  INGREDIENTS: 'ingredients',
  RECIPES: 'recipes',
  USERS: 'users',
} as const;

// Index mappings (simplified for TypeScript compatibility)
export const INDEX_MAPPINGS: Record<string, any> = {
  [ELASTICSEARCH_INDICES.INGREDIENTS]: {
    mappings: {
      properties: {
        id: { type: 'integer' },
        ingredientName: { 
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: {
              type: 'completion',
              analyzer: 'simple',
              search_analyzer: 'simple',
              preserve_separators: true,
              preserve_position_increments: true,
              max_input_length: 50
            }
          }
        },
        category: { type: 'keyword' },
        description: { type: 'text' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' }
      }
    }
  },
  [ELASTICSEARCH_INDICES.RECIPES]: {
    mappings: {
      properties: {
        id: { type: 'integer' },
        recipeName: { 
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: {
              type: 'completion',
              analyzer: 'simple',
              search_analyzer: 'simple',
              preserve_separators: true,
              preserve_position_increments: true,
              max_input_length: 50
            }
          }
        },
        description: { type: 'text' },
        difficulty: { type: 'keyword' },
        prepTime: { type: 'integer' },
        cookTime: { type: 'integer' },
        servings: { type: 'integer' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' }
      }
    }
  }
};

// Health check function
export async function checkElasticsearchHealth(): Promise<boolean> {
  if (!elasticsearchClient) {
    return false;
  }

  try {
    const response = await elasticsearchClient.cluster.health();
    return response.status === 'green' || response.status === 'yellow';
  } catch (error) {
    console.error('Elasticsearch health check failed:', error);
    return false;
  }
}

// Create index if not exists
export async function createIndexIfNotExists(indexName: string): Promise<boolean> {
  if (!elasticsearchClient) {
    console.warn(`⚠️ Elasticsearch not available, skipping index creation: ${indexName}`);
    return false;
  }

  try {
    const exists = await elasticsearchClient.indices.exists({ index: indexName });
    
    if (!exists) {
      const mapping = INDEX_MAPPINGS[indexName as keyof typeof INDEX_MAPPINGS];
      if (mapping) {
        await elasticsearchClient.indices.create({
          index: indexName,
          ...mapping
        });
        console.log(`✅ Created Elasticsearch index: ${indexName}`);
        return true;
      }
    } else {
      console.log(`📋 Elasticsearch index already exists: ${indexName}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Failed to create Elasticsearch index ${indexName}:`, error);
    return false;
  }
}

// Initialize all indices
export async function initializeElasticsearchIndices(): Promise<void> {
  if (!elasticsearchClient) {
    console.log('📝 Elasticsearch not available, skipping index initialization');
    return;
  }

  try {
    console.log('🔍 Initializing Elasticsearch indices...');
    
    for (const indexName of Object.values(ELASTICSEARCH_INDICES)) {
      await createIndexIfNotExists(indexName);
    }
    
    console.log('✅ All Elasticsearch indices initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Elasticsearch indices:', error);
  }
}

export { elasticsearchClient };
export default elasticsearchClient;
