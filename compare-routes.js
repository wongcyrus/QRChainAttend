#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Extract backend routes
function getBackendRoutes() {
  const routes = new Set();
  const functionsDir = 'backend/src/functions';
  
  const files = fs.readdirSync(functionsDir);
  files.forEach(file => {
    if (!file.endsWith('.ts')) return;
    
    const content = fs.readFileSync(path.join(functionsDir, file), 'utf8');
    const matches = content.match(/route:\s*['"]([^'"]+)['"]/g);
    
    if (matches) {
      matches.forEach(match => {
        const route = match.match(/['"]([^'"]+)['"]/)[1];
        routes.add(route);
      });
    }
  });
  
  return Array.from(routes).sort();
}

// Extract frontend API calls
function getFrontendAPICalls() {
  const calls = new Set();
  
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    entries.forEach(entry => {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !['node_modules', '.next', 'dist'].includes(entry.name)) {
        scanDir(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Match fetch calls with template literals
        const matches = content.match(/fetch\s*\(\s*`[^`]*\/api\/[^`]+`/g);
        if (matches) {
          matches.forEach(match => {
            let route = match.match(/\/api\/([^`]+)/);
            if (route) {
              route = route[1]
                .replace(/\$\{[^}]+\}/g, '{id}')
                .replace(/\?.*$/, '');
              calls.add(route);
            }
          });
        }
        
        // Match fetch calls with string concatenation
        const matches2 = content.match(/fetch\s*\(\s*['"][^'"]*\/api\/[^'"]+['"]/g);
        if (matches2) {
          matches2.forEach(match => {
            let route = match.match(/\/api\/([^'"]+)/);
            if (route) {
              route = route[1].replace(/\?.*$/, '');
              calls.add(route);
            }
          });
        }
      }
    });
  }
  
  scanDir('frontend/src');
  return Array.from(calls).sort();
}

console.log('🔍 API Route Comparison\n');

const backendRoutes = getBackendRoutes();
const frontendCalls = getFrontendAPICalls();

console.log('📋 Backend Routes:', backendRoutes.length);
backendRoutes.forEach(r => console.log('  ✓', r));

console.log('\n📱 Frontend API Calls:', frontendCalls.length);
frontendCalls.forEach(r => console.log('  →', r));

console.log('\n⚠️  Potential Mismatches:');
let mismatches = 0;

frontendCalls.forEach(call => {
  // Normalize for comparison
  const normalized = call.replace(/\{id\}/g, '{sessionId}');
  const found = backendRoutes.some(route => {
    const routeNorm = route
      .replace(/{sessionId}/g, '{id}')
      .replace(/{attendeeId}/g, '{id}')
      .replace(/{email}/g, '{id}');
    return routeNorm === call || route === normalized;
  });
  
  if (!found) {
    console.log('  ⚠️  Frontend calls:', call);
    console.log('      No matching backend route found');
    mismatches++;
  }
});

if (mismatches === 0) {
  console.log('  ✅ All frontend calls have matching backend routes');
}

console.log('\n✅ Analysis complete');
