#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitAutoServer {
  constructor() {
    this.server = new Server(
      {
        name: 'cursor-auto-git',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'auto_commit',
            description: 'Tự động commit và push code lên GitHub với xác nhận',
            inputSchema: {
              type: 'object',
              properties: {
                taskName: {
                  type: 'string',
                  description: 'Tên task đã hoàn thành',
                },
                message: {
                  type: 'string',
                  description: 'Commit message bổ sung (optional)',
                },
                confirm: {
                  type: 'boolean',
                  description: 'Xác nhận commit (true/false)',
                },
              },
              required: ['taskName', 'confirm'],
            },
          },
          {
            name: 'check_git_status',
            description: 'Kiểm tra trạng thái Git repository',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'rollback_changes',
            description: 'Rollback thay đổi khi có lỗi',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'auto_commit':
            return await this.autoCommit(args.taskName, args.message, args.confirm);
          case 'check_git_status':
            return await this.checkGitStatus();
          case 'rollback_changes':
            return await this.rollbackChanges();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Lỗi: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async autoCommit(taskName, customMessage, confirm) {
    try {
      const config = this.loadConfig();
      if (!config) {
        return {
          content: [
            {
              type: 'text',
              text: '❌ Không thể load config từ git-config.env',
            },
          ],
        };
      }

      // Kiểm tra xác nhận
      if (!confirm) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Commit bị hủy - Chưa được xác nhận!\n📋 Task: ${taskName}\n💡 Hãy xác nhận bằng cách set confirm: true`,
            },
          ],
        };
      }

      const timestamp = new Date().toISOString();
      const baseMessage = `✅ Hoàn thành task: ${taskName}`;
      const commitMessage = customMessage 
        ? `${baseMessage} - ${customMessage} - ${timestamp}`
        : `${baseMessage} - ${timestamp}`;

      // Kiểm tra xem có thay đổi nào không
      try {
        execSync('git diff --quiet', { stdio: 'pipe' });
        return {
          content: [
            {
              type: 'text',
              text: '✅ Không có thay đổi nào để commit',
            },
          ],
        };
      } catch (error) {
        // Có thay đổi, tiếp tục commit
      }

      // Add tất cả thay đổi
      execSync('git add .', { stdio: 'pipe' });

      // Commit với message
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });

      // Push lên remote
      execSync('git push origin main', { stdio: 'pipe' });

      // Ghi log
      const logPath = path.join(__dirname, '..', '.taskmaster', 'reports', 'git-commits.log');
      const logEntry = `${timestamp} - ${commitMessage}\n`;
      fs.appendFileSync(logPath, logEntry);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Auto commit thành công!\n📋 Task: ${taskName}\n📝 Commit message: ${commitMessage}\n🕒 Timestamp: ${timestamp}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Lỗi trong quá trình auto commit: ${error.message}`,
          },
        ],
      };
    }
  }

  async checkGitStatus() {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const lastCommit = execSync('git log -1 --oneline', { encoding: 'utf8' }).trim();

      return {
        content: [
          {
            type: 'text',
            text: `📊 Git Status:\n🌿 Branch: ${branch}\n📝 Last commit: ${lastCommit}\n📁 Changes: ${status || 'No changes'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Lỗi kiểm tra Git status: ${error.message}`,
          },
        ],
      };
    }
  }

  async rollbackChanges() {
    try {
      execSync('git restore .', { stdio: 'pipe' });
      return {
        content: [
          {
            type: 'text',
            text: '✅ Đã rollback tất cả thay đổi',
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Lỗi rollback: ${error.message}`,
          },
        ],
      };
    }
  }

  loadConfig() {
    const configPath = path.join(__dirname, '..', 'git-config.env');
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const config = {};
    const content = fs.readFileSync(configPath, 'utf8');
    content.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        config[key.trim()] = value.trim();
      }
    });

    return config;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Cursor Auto Git MCP Server đang chạy...');
  }
}

// Chạy server
const server = new GitAutoServer();
server.run().catch(console.error);
