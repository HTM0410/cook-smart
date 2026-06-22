#!/usr/bin/env node

/**
 * Codex Integration Script cho Food Suggest Project
 * Sử dụng Codex như một tool riêng biệt thay vì MCP server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class CodexIntegration {
  constructor() {
    this.codexPath = 'C:\\nvm4w\\nodejs\\codex.ps1';
    this.projectRoot = process.cwd();
  }

  /**
   * Chạy Codex với prompt cụ thể
   * @param {string} prompt - Prompt để gửi cho Codex
   * @param {string} workingDir - Thư mục làm việc (mặc định là project root)
   * @returns {Promise<string>} - Kết quả từ Codex
   */
  async runCodex(prompt, workingDir = this.projectRoot) {
    return new Promise((resolve, reject) => {
      console.log(`🤖 Running Codex with prompt: ${prompt.substring(0, 50)}...`);
      
      const codexProcess = spawn('powershell', [
        '-Command', 
        `cd "${workingDir}"; & "${this.codexPath}" exec "${prompt}"`
      ], { 
        stdio: 'pipe',
        cwd: workingDir
      });

      let output = '';
      let error = '';

      codexProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      codexProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      codexProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Codex failed with code ${code}: ${error}`));
        }
      });
    });
  }

  /**
   * Phân tích code với Codex
   * @param {string} filePath - Đường dẫn file cần phân tích
   * @returns {Promise<string>} - Kết quả phân tích
   */
  async analyzeCode(filePath) {
    const prompt = `Please analyze this code file and provide suggestions for improvement: ${filePath}`;
    return await this.runCodex(prompt);
  }

  /**
   * Tạo code mới với Codex
   * @param {string} description - Mô tả code cần tạo
   * @param {string} language - Ngôn ngữ lập trình
   * @returns {Promise<string>} - Code được tạo
   */
  async generateCode(description, language = 'typescript') {
    const prompt = `Generate ${language} code for: ${description}`;
    return await this.runCodex(prompt);
  }

  /**
   * Sửa lỗi code với Codex
   * @param {string} filePath - File có lỗi
   * @param {string} errorMessage - Thông báo lỗi
   * @returns {Promise<string>} - Code đã sửa
   */
  async fixCode(filePath, errorMessage) {
    const prompt = `Fix the error in ${filePath}: ${errorMessage}`;
    return await this.runCodex(prompt);
  }

  /**
   * Refactor code với Codex
   * @param {string} filePath - File cần refactor
   * @param {string} requirements - Yêu cầu refactor
   * @returns {Promise<string>} - Code đã refactor
   */
  async refactorCode(filePath, requirements) {
    const prompt = `Refactor ${filePath} with these requirements: ${requirements}`;
    return await this.runCodex(prompt);
  }

  /**
   * Tạo documentation với Codex
   * @param {string} filePath - File cần tạo documentation
   * @returns {Promise<string>} - Documentation
   */
  async generateDocumentation(filePath) {
    const prompt = `Generate comprehensive documentation for ${filePath}`;
    return await this.runCodex(prompt);
  }

  /**
   * Test kết nối Codex
   * @returns {Promise<boolean>} - True nếu kết nối thành công
   */
  async testConnection() {
    try {
      const result = await this.runCodex('Hello, can you help me with coding?');
      console.log('✅ Codex connection successful');
      console.log('Response:', result.substring(0, 200) + '...');
      return true;
    } catch (error) {
      console.log('❌ Codex connection failed:', error.message);
      return false;
    }
  }
}

// Export cho sử dụng trong các script khác
module.exports = CodexIntegration;

// CLI usage
if (require.main === module) {
  const codex = new CodexIntegration();
  
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'test':
      codex.testConnection();
      break;
    case 'analyze':
      if (args[0]) {
        codex.analyzeCode(args[0]).then(console.log);
      } else {
        console.log('Usage: node codex-integration.js analyze <file-path>');
      }
      break;
    case 'generate':
      if (args[0]) {
        codex.generateCode(args[0], args[1]).then(console.log);
      } else {
        console.log('Usage: node codex-integration.js generate <description> [language]');
      }
      break;
    case 'fix':
      if (args[0] && args[1]) {
        codex.fixCode(args[0], args[1]).then(console.log);
      } else {
        console.log('Usage: node codex-integration.js fix <file-path> <error-message>');
      }
      break;
    case 'refactor':
      if (args[0] && args[1]) {
        codex.refactorCode(args[0], args[1]).then(console.log);
      } else {
        console.log('Usage: node codex-integration.js refactor <file-path> <requirements>');
      }
      break;
    case 'docs':
      if (args[0]) {
        codex.generateDocumentation(args[0]).then(console.log);
      } else {
        console.log('Usage: node codex-integration.js docs <file-path>');
      }
      break;
    default:
      console.log(`
🤖 Codex Integration Tool - Food Suggest Project

Usage: node codex-integration.js <command> [args]

Commands:
  test                           - Test Codex connection
  analyze <file-path>            - Analyze code file
  generate <description> [lang] - Generate new code
  fix <file-path> <error>       - Fix code errors
  refactor <file-path> <req>     - Refactor code
  docs <file-path>              - Generate documentation

Examples:
  node codex-integration.js test
  node codex-integration.js analyze src/components/RecipeCard.tsx
  node codex-integration.js generate "React component for recipe display" typescript
  node codex-integration.js fix src/utils/api.ts "TypeError: Cannot read property"
      `);
  }
}
