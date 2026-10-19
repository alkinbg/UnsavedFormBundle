# Unsaved Form Bundle

[![Tests](https://github.com/alkinbg/UnsavedFormBundle/actions/workflows/tests.yml/badge.svg)](https://github.com/alkinbg/UnsavedFormBundle/actions/workflows/tests.yml)
[![Release](https://img.shields.io/github/v/release/alkinbg/UnsavedFormBundle)](https://github.com/alkinbg/UnsavedFormBundle/releases/latest)
[![MIT License](https://img.shields.io/github/license/alkinbg/UnsavedFormBundle)](LICENSE)

Protect edited forms from accidental navigation in Symfony applications, with or without Turbo.

The bundle contains one small Stimulus controller. No database tables, backend services, custom form types, or autosave. The UI keeps using the native browser's confirmation for full page unloads.

**Stable release:** v1.0.0 · **PHP:** 8.2+ · **Symfony:** 7.4/8.x · **StimulusBundle:** 2.9/3.x. Browser navigation is covered by automated tests in Chromium, Firefox, and WebKit.

## What it handles

| Navigation or action | Behavior |
| --- | --- |
| Ordinary links and page reload (no Turbo) | Native browser `beforeunload` confirmation |
| Closing a tab or browser | Native `beforeunload` where supported by the browser |
| Turbo Drive links and programmatic `Turbo.visit()` | Confirm before starting the visit |
| Turbo Drive Back/Forward | Confirm and reverse cancelable same-document history traversals before Turbo handles their `popstate` event |
| Turbo Frames (including programmatic `src` updates) | Confirm before replacing a frame containing an edited form |
| Turbo Streams replacing, updating or removing a dirty form | Confirm before a destructive update; declined updates leave the form intact |
| Native successful form submission | No false warning when submitting |
| Turbo form submission | No false warning while submitting; dirty state maintained after an unsuccessful submission where the form is not replaced |
| Reset or revert to the original values | Form becomes clean again |

Changes to standard inputs, checkboxes, radio buttons, selects, textareas, and selected files are tracked by values rather than by a simple "ever touched" flag. A change event is dispatched when the dirty state toggles.

## Installation

Unsaved Form Bundle is [available on Packagist](https://packagist.org/packages/alkin/unsaved-form-bundle). Install the stable 1.x version directly with Composer:

```bash
composer require "alkin/unsaved-form-bundle:^1.0"
```

No custom Composer repository is needed. Install the package in the Symfony project where its forms will be used.

Symfony Flex discovers the bundle and its Stimulus controller. Verify `config/bundles.php` and `assets/controllers.json`. Symfony StimulusBundle and a configured frontend pipeline (such as AssetMapper) are required.

## Using it with Symfony Forms

```twig
{{ form_start(form, {
    attr: {
        'data-controller': 'alkin--unsaved-form-bundle--guard',
        'data-alkin--unsaved-form-bundle--guard-message-value': 'You have unsaved changes. Leave this page?'
    }
}) }}
    {{ form_widget(form) }}
    <span role="status" aria-live="polite" hidden
          data-alkin--unsaved-form-bundle--guard-target="indicator">
        Unsaved changes
    </span>
    <button type="submit">Save</button>
{{ form_end(form) }}
```

You can also use it with a plain HTML form:

```html
<form data-controller="alkin--unsaved-form-bundle--guard" method="post">
    <input name="title" value="Example">
    <button type="submit">Save</button>
</form>
```

The controller is loaded automatically and works with or without Symfony UX Turbo.

### API

- `controller.markClean()`: call after an explicitly confirmed successful AJAX save (when not using Turbo's form submission lifecycle).
- `data-unsaved-form-ignore`: set on fields or wrappers whose values do not need tracking.
- `alkin--unsaved-form-bundle--guard:change`: event on the form with `event.detail.dirty`.
- `indicator` target: optional element shown only while changes are unsaved.

## Browser/platform constraints

**A website cannot guarantee a confirmation on every OS- or browser-initiated termination.** For example, mobile browsers may skip `beforeunload` when an app is force-closed. Browsers control the native confirmation text and may require previous user interaction; our JavaScript cannot override these policies.

Turbo restoration visits do not fire `turbo:before-visit`. The bundle uses the Navigation API history-entry index to reverse declined Back/Forward traversal at `popstate`. It retains unsaved field values in page memory and restores them if Turbo re-renders a cached copy of the form, where the index is available. Browser versions without a history-entry index require a fallback and cannot currently offer the same behavior. The automated browser tests cover modern Chromium, Firefox, and WebKit, including Back, Forward, Frames, Streams, and operation without Turbo.

Turbo Frame navigation is guarded immediately before rendering. When a user declines, the new frame content is not rendered and the frame's `src` is cleared because it no longer represents the visible frame content.

All forms can be explicitly marked clean with `markClean()`. Programmatic changes to field values should dispatch an `input` or `change` event for immediate indicators; navigation always rechecks their actual values. Deliberately replacing a dirty form from arbitrary third-party JavaScript is not a navigation and cannot be prevented without application-specific coordination.

## Contributing, support and security

Found a bug? Use the [bug report form](https://github.com/alkinbg/UnsavedFormBundle/issues/new/choose). Have an idea for a small improvement? See [Contributing](CONTRIBUTING.md) and open a focused feature request.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md), documents its [accessibility considerations](ACCESSIBILITY.md), and accepts [private security reports](SECURITY.md). Never disclose a suspected vulnerability in a public issue.

Release notes are kept in the [Changelog](CHANGELOG.md).

## Development and testing

```bash
composer validate --strict
npm ci
npm test
npm run test:browser
```

The browser suite uses Playwright with a local HTTP fixture and the real Hotwire Turbo 8 library. You must install the browsers first with `npx playwright install --with-deps` (Linux distributions may require OS packages). In CI, the browser test runs separately on Chromium, Firefox, and WebKit.

## License

MIT. Copyright 2026 Novora Labs.
