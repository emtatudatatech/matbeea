import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

// ESLint 10 only supports flat config, and `next lint` was removed in Next 16,
// so linting now runs through the `eslint` CLI against this file.
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'prisma/generated/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
