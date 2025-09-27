module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:n/recommended',
    'plugin:promise/recommended',
    'prettier',
  ],
  settings: {
    'import/extensions': ['.ts', '.tsx', '.js'],
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json'],
        alwaysTryTypes: true,
        extensionAlias: {
          '.js': ['.ts', '.js'],
        },
      },
      node: {
        extensions: ['.ts', '.tsx', '.js'],
      },
    },
  },
  rules: {
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      },
    ],
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'n/no-missing-import': 'off',
    'n/no-unsupported-features/es-syntax': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'promise/no-callback-in-promise': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', 'prisma/*.js'],
};
