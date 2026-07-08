/**
 * Real Backend Server Smoke Test
 *
 * Chạy server backend thật (sẽ bị lỗi DB connection), nhưng song song
 * gọi trực tiếp Intent Pipeline qua Node script để verify:
 *   1. Classifier hoạt động đúng
 *   2. Router phân loại đúng
 *   3. Context resolution với multi-turn
 *
 * Script này dùng để demo pipeline hoạt động độc lập với DB.
 *
 * Run: npx ts-node src/__tests__/intent/realBackendSmokeTest.ts
 */

import { classifyIntent } from '../../services/intent/classifier';
import { routeByIntent, getCannedResponse, RouteType } from '../../services/intent/router';
import { processMessage } from '../../services/intent/pipeline';
import { addMessageToSession, clearSessionContext } from '../../services/intent/sessionStore';
import { IntentType } from '../../services/intent/types';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

function colorize(color: string, text: string) {
  return `${color}${text}${RESET}`;
}

function divider() {
  console.log('\n' + colorize(BLUE, '═'.repeat(60)) + '\n');
}

async function runTest(
  name: string,
  query: string,
  expectedIntent: IntentType,
  expectedRoute: RouteType,
): Promise<boolean> {
  const result = classifyIntent(query);
  const route = routeByIntent(result);
  const passed = result.primaryIntent === expectedIntent && route === expectedRoute;
  const status = passed ? colorize(GREEN, '✓ PASS') : colorize(RED, '✗ FAIL');

  console.log(`${status} | ${name}`);
  console.log(`  Query:           "${query}"`);
  console.log(`  Expected Intent: ${expectedIntent}`);
  console.log(`  Got Intent:      ${result.primaryIntent}`);
  console.log(`  Expected Route:  ${expectedRoute}`);
  console.log(`  Got Route:       ${route}`);
  console.log(`  Confidence:      ${result.confidence.toFixed(2)}`);
  console.log(`  Matched Tier:    ${result.matchedTier}`);

  if (route === RouteType.CANNED) {
    const response = getCannedResponse(result.primaryIntent);
    console.log(`  Response:        "${response.substring(0, 80)}..."`);
  }

  return passed;
}

async function runMultiTurnTest(): Promise<boolean> {
  divider();
  console.log(colorize(YELLOW, '🔄 Multi-turn Conversation Test\n'));

  const sessionId = 'smoke-session-1';
  clearSessionContext(sessionId);

  // Mock RAG processor
  const mockRAG = async (query: string) => ({
    text: `[RAG MOCK] Bạn hỏi: "${query}". Đây là phản hồi giả lập từ Gemini.
1. Gà kho gừng
2. Gà xào hành tây
3. Gà nướng mật ong`,
    sources: [{ recipeId: 1, recipeName: 'Mock Recipe', similarity: 0.9 }],
  });

  // Turn 1: Gợi ý món
  console.log(colorize(BLUE, 'Turn 1: User hỏi "gợi ý món từ thịt gà"'));
  const turn1 = await processMessage(sessionId, 'gợi ý món từ thịt gà', mockRAG);
  console.log(`  Intent: ${turn1.intent.primaryIntent}`);
  console.log(`  Route:  ${turn1.route}`);
  console.log(`  Response: "${turn1.text.substring(0, 100)}..."`);
  console.log(`  Dish refs: ${turn1.dishReferences?.join(', ') || '[]'}\n`);

  // Turn 2: Reference "nó"
  console.log(colorize(BLUE, 'Turn 2: User hỏi "nó cần nguyên liệu gì?"'));
  const turn2 = await processMessage(sessionId, 'nó cần nguyên liệu gì?', mockRAG);
  console.log(`  Intent: ${turn2.intent.primaryIntent}`);
  console.log(`  Route:  ${turn2.route}`);
  console.log(`  Resolved Query: "${turn2.resolvedQuery}"`);
  console.log(`  Response: "${turn2.text.substring(0, 100)}..."\n`);

  // Turn 3: Reference "món thứ 2"
  console.log(colorize(BLUE, 'Turn 3: User hỏi "cách làm món thứ 2"'));
  const turn3 = await processMessage(sessionId, 'cách làm món thứ 2', mockRAG);
  console.log(`  Intent: ${turn3.intent.primaryIntent}`);
  console.log(`  Route:  ${turn3.route}`);
  console.log(`  Resolved Query: "${turn3.resolvedQuery}"`);
  console.log(`  Response: "${turn3.text.substring(0, 100)}..."\n`);

  // Verify
  const passed =
    turn1.intent.primaryIntent === IntentType.RECIPE_SEARCH &&
    turn1.route === RouteType.RAG &&
    turn2.resolvedQuery?.includes('Gà nướng mật ong') === true &&
    turn3.resolvedQuery?.includes('Gà xào hành tây') === true;

  return passed;
}

async function main() {
  divider();
  console.log(colorize(YELLOW, '🚀 Intent Pipeline Smoke Test\n'));
  console.log('Test trực tiếp pipeline không qua HTTP/DB\n');

  let total = 0;
  let passed = 0;

  // ====== Social Tests ======
  divider();
  console.log(colorize(YELLOW, '📋 Tier 1 - Social Tests\n'));
  const socialTests = [
    ['Chào user', 'xin chào', IntentType.GREETING, RouteType.CANNED],
    ['Chào alone', 'chào', IntentType.GREETING, RouteType.CANNED],
    ['Tạm biệt', 'tạm biệt', IntentType.FAREWELL, RouteType.CANNED],
    ['Cảm ơn', 'cảm ơn', IntentType.THANKS, RouteType.CANNED],
    ['Help', 'giúp tôi', IntentType.HELP, RouteType.CANNED],
    ['Who are you', 'bạn là ai', IntentType.WHO_ARE_YOU, RouteType.CANNED],
  ] as const;

  for (const [name, query, intent, route] of socialTests) {
    total++;
    if (await runTest(name, query, intent, route)) passed++;
  }

  // ====== Offtopic Tests ======
  divider();
  console.log(colorize(YELLOW, '📋 Tier 2 - Offtopic Tests\n'));
  const offtopicTests = [
    ['Thời tiết', 'thời tiết hôm nay', IntentType.OFFTOPIC, RouteType.OFFTOPIC_RESPONSE],
    ['Bóng đá', 'bóng đá world cup', IntentType.OFFTOPIC, RouteType.OFFTOPIC_RESPONSE],
    ['Bitcoin', 'bitcoin hôm nay', IntentType.OFFTOPIC, RouteType.OFFTOPIC_RESPONSE],
    ['Game', 'chơi game lol', IntentType.OFFTOPIC, RouteType.OFFTOPIC_RESPONSE],
  ] as const;

  for (const [name, query, intent, route] of offtopicTests) {
    total++;
    if (await runTest(name, query, intent, route)) passed++;
  }

  // ====== Nutrition Tests ======
  divider();
  console.log(colorize(YELLOW, '📋 Tier 3 - Nutrition Tests\n'));
  const nutritionTests = [
    ['Calo', 'phở bò bao nhiêu calo', IntentType.NUTRITION, RouteType.DB_LOOKUP],
    ['Protein', 'protein cao', IntentType.NUTRITION, RouteType.DB_LOOKUP],
    ['Giảm cân', 'giảm cân nên ăn gì', IntentType.NUTRITION, RouteType.DB_LOOKUP],
    ['Cholesterol', 'mỡ máu cao nên ăn gì', IntentType.NUTRITION, RouteType.DB_LOOKUP],
  ] as const;

  for (const [name, query, intent, route] of nutritionTests) {
    total++;
    if (await runTest(name, query, intent, route)) passed++;
  }

  // ====== Recipe Tests ======
  divider();
  console.log(colorize(YELLOW, '📋 Tier 4 - Recipe Tests\n'));
  const recipeTests = [
    ['Phở bò (strong)', 'phở bò', IntentType.RECIPE_SEARCH, RouteType.RAG],
    ['Cách làm phở', 'cách làm phở bò', IntentType.RECIPE_DETAIL, RouteType.DB_LOOKUP],
    ['Cách nấu thịt gà', 'cách nấu thịt gà', IntentType.RECIPE_DETAIL, RouteType.DB_LOOKUP],
    ['Cháo gà (cháo vs chào)', 'cháo gà', IntentType.RECIPE_SEARCH, RouteType.RAG],
    ['Bánh mì (strong)', 'bánh mì', IntentType.RECIPE_SEARCH, RouteType.RAG],
    ['Bún chả', 'bún chả', IntentType.RECIPE_SEARCH, RouteType.RAG],
  ] as const;

  for (const [name, query, intent, route] of recipeTests) {
    total++;
    if (await runTest(name, query, intent, route)) passed++;
  }

  // ====== Clarify Tests ======
  divider();
  console.log(colorize(YELLOW, '📋 Tier 5 - Clarify Tests\n'));
  const clarifyTests = [
    ['Gibberish', 'xyz abc 123', IntentType.CLARIFY, RouteType.CLARIFY],
    ['Empty request', 'k biết', IntentType.CLARIFY, RouteType.CLARIFY],
  ] as const;

  for (const [name, query, intent, route] of clarifyTests) {
    total++;
    if (await runTest(name, query, intent, route)) passed++;
  }

  // ====== Multi-turn test ======
  total++;
  if (await runMultiTurnTest()) passed++;

  // ====== Summary ======
  divider();
  console.log(colorize(YELLOW, '📊 Summary\n'));
  console.log(`Total tests: ${total}`);
  console.log(`Passed:      ${colorize(GREEN, String(passed))}`);
  console.log(`Failed:      ${colorize(RED, String(total - passed))}`);
  console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
  divider();

  if (passed === total) {
    console.log(colorize(GREEN, '🎉 ALL TESTS PASSED!\n'));
    process.exit(0);
  } else {
    console.log(colorize(RED, '❌ SOME TESTS FAILED\n'));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(colorize(RED, 'Fatal error:'), error);
  process.exit(1);
});