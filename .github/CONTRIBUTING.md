# Contributing

Thank you for your interest in contributing to `@flutchai/knowledge`!

## Getting Started

```bash
git clone https://github.com/flutchai/knowledge.git
cd knowledge
yarn install
yarn build
```

## Development Workflow

1. Fork the repository
2. Create a branch: `git checkout -b feat/my-feature` or `fix/my-bug`
3. Make your changes
4. Build: `yarn build`
5. Lint: `yarn lint`
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat: add MongoDB TTL index support`
   - `fix: handle empty content in indexArticle`
   - `docs: update chunking config example`
7. Open a pull request against `main`

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update `CHANGELOG.md` under `[Unreleased]`
- If adding a new public API, update `README.md`

## Reporting Bugs

Open a [GitHub Issue](https://github.com/flutchai/knowledge/issues) using the bug report template.

## Suggesting Features

Open a [GitHub Issue](https://github.com/flutchai/knowledge/issues) using the feature request template.
