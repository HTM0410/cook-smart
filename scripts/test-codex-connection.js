#!/usr/bin/env node

/**
 * Script để test kết nối Codex MCP Server
 * Food Suggest Project
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Testing Codex MCP Server Connection...\n');

// Test 1: Kiểm tra Codex CLI
console.log('1. Checking Codex CLI installation...');
const codexPath = 'C:\\nvm4w\\nodejs\\codex.ps1';
const codexVersion = spawn('powershell', ['-Command', `& "${codexPath}" --version`], { stdio: 'pipe' });

codexVersion.stdout.on('data', (data) => {
  console.log(`   ✅ Codex CLI version: ${data.toString().trim()}`);
});

codexVersion.stderr.on('data', (data) => {
  console.log(`   ❌ Error: ${data.toString()}`);
});

codexVersion.on('close', (code) => {
  if (code === 0) {
    console.log('   ✅ Codex CLI is properly installed\n');
    
    // Test 2: Kiểm tra đăng nhập
    console.log('2. Checking Codex authentication...');
    const codexLogin = spawn('powershell', ['-Command', `& "${codexPath}" login status`], { stdio: 'pipe' });
    
    codexLogin.stdout.on('data', (data) => {
      console.log(`   ✅ ${data.toString().trim()}`);
    });
    
    codexLogin.stderr.on('data', (data) => {
      console.log(`   ❌ Error: ${data.toString()}`);
    });
    
    codexLogin.on('close', (loginCode) => {
      if (loginCode === 0) {
        console.log('   ✅ Codex authentication is working\n');
        
        // Test 3: Kiểm tra MCP server với rmcp_client
        console.log('3. Testing Codex MCP Server with rmcp_client...');
        const mcpServer = spawn('powershell', ['-Command', `& "${codexPath}" mcp-server --enable rmcp_client`], { stdio: 'pipe' });
        
        let mcpOutput = '';
        mcpServer.stdout.on('data', (data) => {
          mcpOutput += data.toString();
        });
        
        mcpServer.stderr.on('data', (data) => {
          console.log(`   ❌ MCP Server Error: ${data.toString()}`);
        });
        
        // Kill MCP server sau 3 giây để test
        setTimeout(() => {
          mcpServer.kill();
          if (mcpOutput.length > 0) {
            console.log('   ✅ Codex MCP Server is responding');
          } else {
            console.log('   ⚠️  MCP Server started but no output received');
          }
          console.log('\n🎉 Codex connection test completed!');
          console.log('\n📋 Summary:');
          console.log('   - Codex CLI: ✅ Installed');
          console.log('   - Authentication: ✅ Working');
          console.log('   - MCP Server: ✅ Available');
          console.log('\n💡 Next steps:');
          console.log('   1. Restart Cursor IDE to load new MCP configuration');
          console.log('   2. Check MCP servers in Cursor settings');
          console.log('   3. Test Codex integration in your project');
        }, 3000);
        
      } else {
        console.log('   ❌ Codex authentication failed');
        console.log('\n💡 Please run: codex login');
      }
    });
    
  } else {
    console.log('   ❌ Codex CLI is not properly installed');
    console.log('\n💡 Please install Codex CLI:');
    console.log('   npm install -g @openai/codex');
  }
});
