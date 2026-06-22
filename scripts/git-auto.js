#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Đọc config từ file git-config.env
function loadConfig() {
  const configPath = path.join(__dirname, '..', 'git-config.env');
  if (!fs.existsSync(configPath)) {
    console.log('❌ File git-config.env không tồn tại');
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

// Thực hiện auto commit với xác nhận
function autoCommit(taskName = 'Unknown Task') {
  try {
    const config = loadConfig();
    if (!config) return;
    
    const timestamp = new Date().toISOString();
    const commitMessage = `✅ Hoàn thành task: ${taskName} - ${timestamp}`;
    
    console.log('🔄 Đang thực hiện auto commit...');
    console.log(`📋 Task: ${taskName}`);
    
    // Kiểm tra xem có thay đổi nào không
    try {
      execSync('git diff --quiet', { stdio: 'pipe' });
      console.log('✅ Không có thay đổi nào để commit');
      return;
    } catch (error) {
      // Có thay đổi, tiếp tục commit
    }
    
    // Add tất cả thay đổi
    execSync('git add .', { stdio: 'inherit' });
    
    // Commit với message
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    // Push lên remote
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('✅ Auto commit thành công!');
    console.log(`📝 Commit message: ${commitMessage}`);
    
    // Ghi log
    const logPath = path.join(__dirname, '..', '.taskmaster', 'reports', 'git-commits.log');
    const logEntry = `${timestamp} - ${commitMessage}\n`;
    fs.appendFileSync(logPath, logEntry);
    
  } catch (error) {
    console.error('❌ Lỗi trong quá trình auto commit:', error.message);
  }
}

// Chạy auto commit
autoCommit();
