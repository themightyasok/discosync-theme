/**
 * Lint-staged configuration
 * Runs checks on staged files before commit
 */

module.exports = {
  // JavaScript files - run ESLint
  'assets/**/*.js': [
    'eslint --fix',
    'prettier --write',
  ],
  
          // Liquid template files - format with Prettier (Theme Check runs separately)
          '**/*.liquid': [
            'prettier --write',
          ],
  
  // JSON files - format with Prettier
  '**/*.json': [
    'prettier --write',
  ],
  
  // SCSS/CSS files - format with Prettier
  '**/*.{scss,css}': [
    'prettier --write',
  ],
  
  // Config files
  '*.{js,json,md}': [
    'prettier --write',
  ],
};

