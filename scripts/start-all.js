#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

function run(command, args, cwd, name) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });
  return child;
}

const root = process.cwd();
const backendDir = path.join(root, 'src', 'backend');
const frontendDir = path.join(root, 'src', 'frontend');

// Backend: prefer dev (ts-node) if available, else start (built)
const backendCmd = 'npm';
const backendArgs = ['run', 'dev'];

// Frontend: vite dev
const frontendCmd = 'npm';
const frontendArgs = ['run', 'dev'];

console.log('Starting backend and frontend...');
const backend = run(backendCmd, backendArgs, backendDir, 'backend');

// Delay frontend a bit to avoid port races if needed
setTimeout(() => {
  run(frontendCmd, frontendArgs, frontendDir, 'frontend');
}, 1000);

// Forward SIGINT/SIGTERM to children
function shutdown() {
  backend && backend.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);




