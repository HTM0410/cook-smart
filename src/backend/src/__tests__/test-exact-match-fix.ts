/**
 * Test exact match fix với query "cách nấu phở bò bắp hoa"
 * và follow-up queries.
 */
import { processRAGQuery } from '../services/ragService';

async function main() {
  const queries = [
    'Phở bò',
    'cách nấu phở bò bắp hoa',
    'Cách làm bún chả',
    'nấu bò kho',
    'cách làm bánh xèo',
    'Phở cuốn',
  ];

  for (const q of queries) {
    console.log('\n=========================================');
    console.log('QUERY:', q);
    console.log('=========================================');
    const t0 = Date.now();
    try {
      const resp = await processRAGQuery(q, []);
      const elapsed = Date.now() - t0;
      console.log(`[${elapsed}ms] sources=${resp.sources.length}`);
      console.log('--- RESPONSE ---');
      console.log(resp.text);
      console.log('--- SOURCES ---');
      for (const s of resp.sources.slice(0, 3)) {
        console.log(`- #${s.recipeId} ${s.recipeName}`);
      }
    } catch (err) {
      console.error('ERROR:', (err as Error).message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });