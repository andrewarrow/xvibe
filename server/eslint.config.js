import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'videos/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-console': 'off'
    }
  }
];