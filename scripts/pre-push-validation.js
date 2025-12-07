#!/usr/bin/env node
/**
 * Pre-push Validation Script
 * Runs comprehensive checks before push (more thorough than pre-commit)
 */

import { execSync } from 'child_process';

const errors = [];

function runCommand(command, description) {
  try {
    execSync(command, { stdio: 'pipe' });
    console.log(`✅ ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ ${description}`);
    console.error(error.stdout?.toString() || error.message);
    errors.push(description);
    return false;
  }
}

function main() {
  console.log('🔍 Running pre-push validation (comprehensive checks)...\n');

  // Run full linting
  runCommand('npm run lint', 'JavaScript linting (ESLint)');
  
  // Run theme check on all files
  runCommand('npx theme-check --list', 'Theme Check validation');
  
  // Check for build errors (if build files exist)
  try {
    runCommand('npm run build 2>&1 | head -20', 'Build validation');
  } catch (error) {
    console.log('⚠️  Build check skipped (build may not be required)');
  }

  console.log('\n');

  if (errors.length > 0) {
    console.log(`❌ Pre-push validation failed (${errors.length} errors)`);
    console.log('Fix errors before pushing.\n');
    process.exit(1);
  }

  console.log('✅ All pre-push validation checks passed!\n');
}

main();

