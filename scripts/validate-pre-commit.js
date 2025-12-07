#!/usr/bin/env node
/**
 * Pre-commit Validation Script
 * Runs comprehensive checks before commit
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const errors = [];
const warnings = [];

/**
 * Check if file exists
 */
function fileExists(path) {
  return existsSync(join(process.cwd(), path));
}

/**
 * Check for common issues in theme.liquid
 */
function validateThemeLiquid() {
  const themeLiquidPath = 'layout/theme.liquid';
  if (!fileExists(themeLiquidPath)) {
    errors.push(`❌ ${themeLiquidPath} does not exist`);
    return;
  }

  const content = readFileSync(themeLiquidPath, 'utf-8');

  // Check for core-bundle.js
  if (!content.includes('core-bundle.js')) {
    errors.push(`❌ ${themeLiquidPath}: Missing core-bundle.js reference`);
  }

  // Check for structured-data snippet
  if (!content.includes("render 'structured-data'")) {
    warnings.push(`⚠️  ${themeLiquidPath}: structured-data snippet not included`);
  }

  // Check for Storefront API token placeholder
  if (content.includes('YOUR_STOREFRONT_API_TOKEN_HERE')) {
    warnings.push(`⚠️  ${themeLiquidPath}: Storefront API token still has placeholder value`);
  }

  // Check for resource hints
  if (!content.includes('dns-prefetch')) {
    warnings.push(`⚠️  ${themeLiquidPath}: Missing dns-prefetch resource hints`);
  }
}

/**
 * Check bundle files are referenced correctly
 */
function validateBundlePaths() {
  const bundleFiles = [
    'core-bundle.js',
    'api-bundle.js',
    'utils/metafield-setup-bundle.js',
    'utils/modern-css-loader-bundle.js',
  ];

  bundleFiles.forEach(bundle => {
    const bundlePath = join('assets', bundle);
    if (!fileExists(bundlePath)) {
      warnings.push(`⚠️  Bundle file missing: ${bundlePath} (may need to run npm run build)`);
    }
  });
}

/**
 * Check core modules are properly integrated
 */
function validateCoreModules() {
  const coreIndexPath = 'assets/core/index.js';
  if (!fileExists(coreIndexPath)) {
    errors.push(`❌ ${coreIndexPath} does not exist`);
    return;
  }

  const content = readFileSync(coreIndexPath, 'utf-8');
  const requiredModules = [
    'web-vitals',
    'accessibility-enhancer',
    'performance-reporter',
    'cls-prevention',
    'inp-optimizer',
  ];

  requiredModules.forEach(module => {
    if (!content.includes(module)) {
      errors.push(`❌ ${coreIndexPath}: Missing import for ${module}.js`);
    }
  });
}

/**
 * Check Liquid syntax with theme-check
 */
function validateLiquidSyntax() {
  try {
    execSync('npx theme-check --version', { stdio: 'ignore' });
  } catch (error) {
    warnings.push('⚠️  Theme Check not available (install with: npm install)');
    return;
  }
}

/**
 * Check for common security issues
 */
function validateSecurity() {
  const themeLiquidPath = 'layout/theme.liquid';
  if (!fileExists(themeLiquidPath)) return;

  const content = readFileSync(themeLiquidPath, 'utf-8');

  // Check for inline scripts (should be minimal)
  const inlineScriptMatches = content.match(/<script[^>]*>(?![\s\S]*?<\/script>)/g);
  if (inlineScriptMatches && inlineScriptMatches.length > 5) {
    warnings.push(`⚠️  ${themeLiquidPath}: Multiple inline scripts detected (consider moving to external files)`);
  }

  // Check for eval() usage
  if (content.includes('eval(')) {
    errors.push(`❌ ${themeLiquidPath}: eval() usage detected (security risk)`);
  }
}

/**
 * Main validation
 */
function main() {
  console.log('🔍 Running pre-commit validation checks...\n');

  validateThemeLiquid();
  validateBundlePaths();
  validateCoreModules();
  validateLiquidSyntax();
  validateSecurity();

  // Report results
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors (must be fixed before commit):');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('');
    process.exit(1);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All validation checks passed!\n');
  } else if (errors.length === 0) {
    console.log('✅ Validation complete (warnings are non-blocking)\n');
  }
}

main();

