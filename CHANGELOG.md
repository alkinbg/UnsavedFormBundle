# Changelog

## [1.0.0] - 2026-10-19

Initial stable release.

- Track unsaved values in standard HTML and Symfony forms without server-side changes.
- Guard native browser navigations using the built-in `beforeunload` confirmation.
- Guard Turbo Drive visits, Back/Forward history, and destructive Turbo Frame and Stream updates.
- Preserve the original dirty baseline and edited field values across Turbo cache restorations.
- Handle resets, reverted edits, and successful or failed form submissions.
- Provide a one-controller Stimulus integration compatible with Symfony 7.4/8.x.
- Verify with unit tests and Playwright browser tests in Chromium, Firefox, and WebKit.

Browser APIs may not show confirmation on OS-forced termination or on unsupported legacy browsers; see the README.

[1.0.0]: https://github.com/alkinbg/UnsavedFormBundle/releases/tag/v1.0.0
