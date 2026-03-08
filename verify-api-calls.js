#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Get backend routes
const backendRoutes = new Set();
const functionsDir = 'backend/src/functions';
fs.readdirSync(functionsDir).forEach(file => {
  if (!file.endsWith('.ts')) return;
  const content = fs.readFileSync(path.join(functionsDir, file), 'utf8');
  const matches = content.match(/route:\s*['"]([^'"]+)['"]/g);
  if (matches) {
    matches.forEach(m => {
      const route = m.match(/['"]([^'"]+)['"]/)[1];
      backendRoutes.add(route);
    });
  }
});

// Get frontend API calls (excluding tests and examples)
const frontendCalls = [];

function scanFile(filePath) {
  if (filePath.includes('.test.') || filePath.includes('.example.') || 
      filePath.includes('node_modules') || filePath.includes('.next')) {
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    // Match fetch calls
    const fetchMatch = line.match(/fetch\s*\(\s*`([^`]+)`/);
    if (fetchMatch) {
      let url = fetchMatch[1];
      if (url.includes('/api/')) {
        const route = url.split('/api/')[1].split('`')[0];
        frontendCalls.push({
          file: filePath.replace('frontend/src/', ''),
          line: idx + 1,
          route: route,
          raw: url
        });
      }
    }
  });
}

function walkDir(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  });
}

walkDir('frontend/src');

console.log('🔍 Frontend API Call Verification\n');
console.log(`Found ${frontendCalls.length} API calls in production code\n`);

let issues = 0;

frontendCalls.forEach(call => {
  // Normalize route for comparison
  let normalized = call.route
    .replace(/\$\{sessionId\}/g, '{sessionId}')
    .replace(/\$\{attendeeId\}/g, '{attendeeId}')
    .replace(/\$\{email\}/g, '{email}')
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\?.*$/, '');
  
  // Check if route exists in backend
  const exists = Array.from(backendRoutes).some(br => {
    return br === normalized || 
           br.replace(/{[^}]+}/g, '{param}') === normalized.replace(/{[^}]+}/g, '{param}');
  });
  
  if (!exists && !call.route.startsWith('auth/mock-login')) {
    console.log(`⚠️  ${call.file}:${call.line}`);
    console.log(`   Calls: ${normalized}`);
    console.log(`   No matching backend route\n`);
    issues++;
  }
});

if (issues === 0) {
  console.log('✅ All API calls have matching backend routes!');
} else {
  console.log(`\n⚠️  Found ${issues} potential issues`);
}
