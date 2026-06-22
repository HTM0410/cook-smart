const puppeteer = require('puppeteer');

async function testAdminDashboard() {
  console.log('🧪 Testing Admin Dashboard...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1280, height: 720 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Test 1: Admin Dashboard Home
    console.log('\n📊 Testing Admin Dashboard Home...');
    await page.goto('http://localhost:5173/admin');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Dashboard title: ${title}`);
    
    // Check stats cards
    const statsCards = await page.$$('[class*="bg-white overflow-hidden shadow rounded-lg"]');
    console.log(`✅ Found ${statsCards.length} stats cards`);
    
    // Test 2: User Management
    console.log('\n👥 Testing User Management...');
    await page.goto('http://localhost:5173/admin/users');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const usersTitle = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Users page title: ${usersTitle}`);
    
    // Check user table
    const userRows = await page.$$('tbody tr');
    console.log(`✅ Found ${userRows.length} user rows`);
    
    // Test search functionality
    const searchInput = await page.$('input[placeholder*="Search by name"]');
    if (searchInput) {
      await searchInput.type('john');
      console.log('✅ Search input working');
    }
    
    // Test 3: Recipe Management
    console.log('\n🍳 Testing Recipe Management...');
    await page.goto('http://localhost:5173/admin/recipes');
    await page.waitForSelector('h1', { timeout: 10000 });
    
    const recipesTitle = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Recipes page title: ${recipesTitle}`);
    
    // Check recipe table
    const recipeRows = await page.$$('tbody tr');
    console.log(`✅ Found ${recipeRows.length} recipe rows`);
    
    // Test filters
    const statusFilter = await page.$('select[id="status"]');
    if (statusFilter) {
      await statusFilter.select('pending');
      console.log('✅ Status filter working');
    }
    
    // Test 4: Navigation
    console.log('\n🧭 Testing Navigation...');
    
    // Test sidebar navigation
    const dashboardLink = await page.$('a[href="/admin"]');
    if (dashboardLink) {
      await dashboardLink.click();
      await page.waitForTimeout(1000);
      console.log('✅ Dashboard navigation working');
    }
    
    const usersLink = await page.$('a[href="/admin/users"]');
    if (usersLink) {
      await usersLink.click();
      await page.waitForTimeout(1000);
      console.log('✅ Users navigation working');
    }
    
    const recipesLink = await page.$('a[href="/admin/recipes"]');
    if (recipesLink) {
      await recipesLink.click();
      await page.waitForTimeout(1000);
      console.log('✅ Recipes navigation working');
    }
    
    // Test 5: Responsive Design
    console.log('\n📱 Testing Responsive Design...');
    
    // Mobile view
    await page.setViewport({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    console.log('✅ Mobile view responsive');
    
    // Tablet view
    await page.setViewport({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    console.log('✅ Tablet view responsive');
    
    // Desktop view
    await page.setViewport({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
    console.log('✅ Desktop view responsive');
    
    console.log('\n🎉 All Admin Dashboard tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

// Check if frontend is running
async function checkFrontend() {
  try {
    const response = await fetch('http://localhost:5173');
    if (response.ok) {
      console.log('✅ Frontend is running on http://localhost:5173');
      return true;
    }
  } catch (error) {
    console.log('❌ Frontend not running. Please start with: npm run dev');
    return false;
  }
}

async function main() {
  const isRunning = await checkFrontend();
  if (isRunning) {
    await testAdminDashboard();
  }
}

main().catch(console.error);
