#!/usr/bin/env node

/**
 * Distribution Package Creator
 * Creates a clean distribution package for Shopify theme upload
 * Excludes development files and only includes built/compiled assets
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = 'dist-package';
const THEME_DIR = path.join(DIST_DIR, 'discosync-theme');

// Files and directories to include
const INCLUDE_PATTERNS = [
  'assets/**/*.js',
  'assets/**/*.css',
  'assets/**/*.svg',
  'assets/**/*.jpg',
  'assets/**/*.png',
  'assets/**/*.gif',
  'assets/**/*.woff',
  'assets/**/*.woff2',
  'layout/**/*',
  'sections/**/*',
  'snippets/**/*',
  'templates/**/*',
  'locales/**/*',
  'config/**/*',
  'README.md',
  'LICENSE.md',
  'release-notes.md',
  'translation.yml',
];

// Files and directories to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  'scss',
  'vite.config.js',
  'postcss.config.js',
  'package.json',
  'package-lock.json',
  '.git',
  '.gitignore',
  '.vscode',
  '.idea',
  'daddypop',
  'docs',
  'scripts',
  'IMPLEMENTATION_SUMMARY.md',
  'DEVELOPMENT_VS_DISTRIBUTION.md',
  'README_BUILD.md',
  'INTEGRATION_COMPLETE.md',
  'INTEGRATION_SUMMARY.md',
  '.vite',
  'dist',
  'dist-package',
  '*.log',
  '.DS_Store',
  // Exclude source files (only include built bundles)
  'assets/core/*.js', // Exclude source, include bundles
  'assets/api/*.js', // Exclude source, include bundles
  'assets/components/*.js', // Exclude source, include bundles
  'assets/utils/*.js', // Exclude source, include bundles
];

function shouldInclude(filePath) {
  // Check exclude patterns
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filePath.includes(pattern) || filePath.endsWith(pattern)) {
      // But allow bundles
      if (filePath.includes('-bundle.js') || filePath.includes('chunks/')) {
        continue;
      }
      return false;
    }
  }
  
  // Check if it's a source file that should be excluded
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  
  // Exclude source files in core/api/components/utils
  if (filePath.includes('/assets/core/') && fileName.endsWith('.js') && !fileName.includes('-bundle')) {
    return false;
  }
  if (filePath.includes('/assets/api/') && fileName.endsWith('.js') && !fileName.includes('-bundle')) {
    return false;
  }
  if (filePath.includes('/assets/components/') && fileName.endsWith('.js') && !fileName.includes('-bundle')) {
    return false;
  }
  if (filePath.includes('/assets/utils/') && fileName.endsWith('.js') && !fileName.includes('-bundle')) {
    return false;
  }
  
  return true;
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    const relativePath = path.relative(process.cwd(), srcPath);
    
    if (!shouldInclude(relativePath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function createDistPackage() {
  console.log('📦 Creating distribution package...');
  
  // Clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(THEME_DIR, { recursive: true });
  
  // Copy theme files
  const directoriesToCopy = [
    'layout',
    'sections',
    'snippets',
    'templates',
    'locales',
    'config',
    'assets',
  ];
  
  const filesToCopy = [
    'README.md',
    'LICENSE.md',
    'release-notes.md',
    'translation.yml',
  ];
  
  console.log('📂 Copying directories...');
  for (const dir of directoriesToCopy) {
    if (fs.existsSync(dir)) {
      console.log(`   Copying ${dir}/`);
      copyDirectory(dir, path.join(THEME_DIR, dir));
    }
  }
  
  console.log('📄 Copying files...');
  for (const file of filesToCopy) {
    if (fs.existsSync(file)) {
      console.log(`   Copying ${file}`);
      copyFile(file, path.join(THEME_DIR, file));
    }
  }
  
  // Verify bundles exist
  const requiredBundles = [
    'assets/core-bundle.js',
    'assets/api-bundle.js',
    'assets/components/collection-grouping-enhancer-bundle.js',
    'assets/utils/metafield-setup-bundle.js',
    'assets/utils/modern-css-loader-bundle.js',
  ];
  
  console.log('\n✅ Verifying bundles...');
  let allBundlesExist = true;
  for (const bundle of requiredBundles) {
    const bundlePath = path.join(THEME_DIR, bundle);
    if (fs.existsSync(bundlePath)) {
      const stats = fs.statSync(bundlePath);
      console.log(`   ✓ ${bundle} (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`   ✗ ${bundle} - MISSING!`);
      allBundlesExist = false;
    }
  }
  
  if (!allBundlesExist) {
    console.error('\n❌ Error: Some required bundles are missing!');
    console.error('   Run "npm run build" first to create bundles.');
    process.exit(1);
  }
  
  // Create package.json for distribution (minimal, no dev deps)
  const distPackageJson = {
    name: 'discosync-theme',
    version: require('../package.json').version || '1.0.0',
    description: 'DiscoSync Shopify theme with advanced product grouping and search',
    author: '',
    license: 'MIT',
  };
  
  fs.writeFileSync(
    path.join(THEME_DIR, 'package.json'),
    JSON.stringify(distPackageJson, null, 2)
  );
  
  console.log('\n✅ Distribution package created!');
  console.log(`   Location: ${THEME_DIR}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Review the package in dist-package/discosync-theme/');
  console.log('   2. Create a ZIP file: cd dist-package && zip -r discosync-theme.zip discosync-theme/');
  console.log('   3. Upload discosync-theme.zip to Shopify');
}

// Run if called directly
if (require.main === module) {
  try {
    createDistPackage();
  } catch (error) {
    console.error('\n❌ Error creating distribution package:', error.message);
    process.exit(1);
  }
}

module.exports = { createDistPackage };

