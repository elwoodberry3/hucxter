import nextVitals from 'eslint-config-next/core-web-vitals';
import base from '../../eslint.config.mjs';

// Next's layer first so the shared TypeScript parser and typed rules win for .ts/.tsx files.
const config = [...nextVitals, ...base];

export default config;
