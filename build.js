const { execSync } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { resolve } = require('path');

// Ensure lib directory exists
const libDir = resolve(__dirname, 'lib');
if (!existsSync(libDir)) {
  mkdirSync(libDir, { recursive: true });
}

// Run TypeScript compiler
try {
  console.log('Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('TypeScript compilation completed successfully!');
} catch (error) {
  console.error('Error compiling TypeScript:', error.message);
  process.exit(1);
}
