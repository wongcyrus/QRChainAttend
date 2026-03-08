#!/usr/bin/env node
/**
 * Fix imports after file renames
 */

const fs = require('fs');
const path = require('path');

const IMPORT_MAP = {
  // Page imports
  "from './teacher'": "from './organizer'",
  "from '../pages/teacher'": "from '../pages/organizer'",
  "from './student'": "from './attendee'",
  "from '../pages/student'": "from '../pages/attendee'",
  
  // Component imports
  "from './TeacherDashboard'": "from './OrganizerDashboard'",
  "from './TeacherDashboardTabs'": "from './OrganizerDashboardTabs'",
  "from './TeacherDashboardWithTabs'": "from './OrganizerDashboardWithTabs'",
  "from './TeacherHeader'": "from './OrganizerHeader'",
  "from './TeacherCaptureControl'": "from './OrganizerCaptureControl'",
  "from './StudentSessionView'": "from './AttendeeSessionView'",
  "from './StudentCaptureUI'": "from './AttendeeCaptureUI'",
  "from '../components/TeacherDashboard'": "from '../components/OrganizerDashboard'",
  "from '../components/TeacherDashboardTabs'": "from '../components/OrganizerDashboardTabs'",
  "from '../components/TeacherDashboardWithTabs'": "from '../components/OrganizerDashboardWithTabs'",
  "from '../components/TeacherHeader'": "from '../components/OrganizerHeader'",
  "from '../components/TeacherCaptureControl'": "from '../components/OrganizerCaptureControl'",
  "from '../components/StudentSessionView'": "from '../components/AttendeeSessionView'",
  "from '../components/StudentCaptureUI'": "from '../components/AttendeeCaptureUI'",
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [oldImport, newImport] of Object.entries(IMPORT_MAP)) {
    if (content.includes(oldImport)) {
      content = content.replaceAll(oldImport, newImport);
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
    
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(file)) {
      callback(filePath);
    }
  }
}

console.log('🔧 Fixing imports after file renames...\n');

let count = 0;
['frontend/src', 'backend/src'].forEach(dir => {
  walkDir(dir, (filePath) => {
    if (processFile(filePath)) {
      count++;
      console.log(`  ✓ ${filePath}`);
    }
  });
});

console.log(`\n✅ Fixed imports in ${count} files`);
