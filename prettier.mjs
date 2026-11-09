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
  // Only slide decks use the Slidev parser. Task texts (body.md, hint.md, ...), READMEs and docs are
  // plain Markdown: the Slidev parser would read their `---` and lists as slide separators and
  // frontmatter.
  // prettier-plugin-slidev claims every .md file by default, so all Markdown is set back to the
  // markdown parser first; later overrides win.
  overrides: [
    { files: '*.md', options: { parser: 'markdown' } },
    {
      files: [
        'slides.md',
        '00-index.md',
        'sources.md',
        'lessons/*/*.md',
        'lessons/*/slides/**/*.md',
        'pages/**/*.md',
      ],
      options: { parser: 'slidev' },
    },
  ],
};
