// Shared Prettier config for workshops.de slide repositories.
// Use it with "prettier": "@workshops.de/slidev-toolkit/prettier" in package.json.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  // Resolved here so the plugin is found even though it is a dependency of this package,
  // not of the slide repository.
  plugins: [require.resolve('prettier-plugin-slidev')],
  overrides: [{ files: '*.md', options: { parser: 'slidev' } }],
};
