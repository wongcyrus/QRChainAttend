#!/usr/bin/env node
/**
 * Fix backend function imports and exports after renames
 */

const fs = require('fs');
const path = require('path');

const FUNCTION_RENAMES = {
  'getStudentQuestions': 'getAttendeeQuestions',
  'getStudentToken': 'getAttendeeToken',
  'markStudentExit': 'markAttendeeExit',
  'getCoTeachers': 'getCoOrganizers',
  'getTeacherSessions': 'getOrganizerSessions',
  'manageExternalTeachers': 'manageExternalOrganizers',
  'removeCoTeacher': 'removeCoOrganizer',
  'studentNegotiate': 'attendeeNegotiate',
  'studentOnline': 'attendeeOnline',
  'negotiateDashboard': 'negotiateDashboard', // Keep as is
};

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [oldName, newName] of Object.entries(FUNCTION_RENAMES)) {
    // Update imports
    const importPattern = new RegExp(`from ['"]\\./functions/${oldName}['"]`, 'g');
    if (importPattern.test(content)) {
      content = content.replace(importPattern, `from './functions/${newName}'`);
      modified = true;
    }
    
    // Update relative imports
    const relativePattern = new RegExp(`from ['"]\\.\\./${oldName}['"]`, 'g');
    if (relativePattern.test(content)) {
      content = content.replace(relativePattern, `from '../${newName}'`);
      modified = true;
    }
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
    
    if (file === 'node_modules' || file === '.git') continue;
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file)) {
      callback(filePath);
    }
  }
}

console.log('🔧 Fixing backend function imports...\n');

let count = 0;
walkDir('backend/src', (filePath) => {
  if (updateImports(filePath)) {
    count++;
    console.log(`  ✓ ${filePath}`);
  }
});

walkDir('frontend/src', (filePath) => {
  if (updateImports(filePath)) {
    count++;
    console.log(`  ✓ ${filePath}`);
  }
});

console.log(`\n✅ Fixed ${count} files`);
