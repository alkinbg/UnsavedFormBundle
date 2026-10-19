# Contributing to Unsaved Form Bundle

Thank you for your interest! This project intentionally stays small: one Stimulus controller, focused Symfony integration, and predictable behavior with and without Turbo. Changes that reduce integration friction or improve browser reliability are welcome.

## Before opening an issue

Search [existing issues](https://github.com/alkinbg/UnsavedFormBundle/issues) first. For a reproducible bug, include the bundle version, PHP/Symfony/StimulusBundle versions when applicable, browser and Turbo version, and exact steps to reproduce.

For feature proposals, explain which everyday developer task would become easier. A short usage example is more helpful than a long specification.

**Do not disclose security vulnerabilities in public issues.** Use [private reporting](SECURITY.md).

## Local setup

You will need PHP 8.2+, Composer 2, Node.js 22+, and npm. The browser suite uses Playwright.

```bash
git clone https://github.com/alkinbg/UnsavedFormBundle.git
cd UnsavedFormBundle
composer install
npm ci
composer validate --strict
npm test
```

For browser testing, install the browsers first and then run the suite:

```bash
npx playwright install chromium firefox webkit
npm run test:browser
```

On Linux, Playwright may require additional system libraries. Follow the installation diagnostics for your distribution rather than assuming your machine can use the `--with-deps` switch.

To run one engine, set `UNSAVED_BROWSER` to `chromium`, `firefox`, or `webkit`. GitHub Actions runs the matrix automatically.

## Contribution guidelines

1. Start from `main` and create a descriptive branch.
2. Keep changes focused on a concrete user-facing improvement or a demonstrated bug.
3. Add a regression test for behavioral changes. For browser navigation, add a real-browser scenario where practical.
4. Maintain compatibility with supported PHP and Symfony versions.
5. Update the README and/or changelog when behavior or setup changes.
6. Verify `composer validate --strict`, `npm test`, and relevant browser tests before opening a pull request.
7. Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md); link the related issue, if any.

Avoid unnecessary runtime dependencies, large abstractions, committed generated browser bundles, `vendor/`, `node_modules/`, and machine-specific files. The public controller code lives in `assets/dist/controller.js`; the browser fixtures live under `tests/browser/`.

We favor small fixes and understandable tests over broad rewrites. Contributions are licensed under the project's [MIT license](LICENSE), and participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
