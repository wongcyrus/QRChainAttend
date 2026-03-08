#!/usr/bin/env node
/**
 * Fix formatStudentId imports
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix import path
  if (content.includes("from '../utils/formatStudentId'")) {
    content = content.replace(/from '\.\.\/utils\/formatStudentId'/g, "from '../utils/formatAttendeeId'");
    modified = true;
  }
  
  if (content.includes('from "../utils/formatStudentId"')) {
    content = content.replace(/from "\.\.\/utils\/formatStudentId"/g, 'from "../utils/formatAttendeeId"');
    modified = true;
  }
  
  // Fix function calls
  if (content.includes('formatStudentId(')) {
    content = content.replace(/formatStudentId\(/g, 'formatAttendeeId(');
    modified = true;
  }
  
  if (content.includes('formatStudentIds(')) {
    content = content.replace(/formatStudentIds\(/g, 'formatAttendeeIds(');
    modified = true;
  }
  
  // Fix imports
  if (content.includes('{ formatStudentId }')) {
    content = content.replace(/\{ formatStudentId \}/g, '{ formatAttendeeId }');
    modified = true;
  }
  
  if (content.includes('{ formatStudentIds }')) {
    content = content.replace(/\{ formatStudentIds \}/g, '{ formatAttendeeIds }');
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(file)) {
      callback(filePath);
    }
  }
}

console.log('🔧 Fixing formatStudentId references...\n');

let count = 0;
walkDir('frontend/src', (filePath) => {
  if (fixFile(filePath)) {
    count++;
    console.log(`  ✓ ${filePath}`);
  }
});

walkDir('backend/src', (filePath) => {
  if (fixFile(filePath)) {
    count++;
    console.log(`  ✓ ${filePath}`);
  }
});

console.log(`\n✅ Fixed ${count} files`);
