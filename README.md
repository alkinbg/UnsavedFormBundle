# Unsaved Form Bundle

Protect edited forms from accidental navigation in Symfony applications, with or without Turbo.

The bundle contains one small Stimulus controller. No database tables, backend services, custom form types, or autosave. The UI keeps using the native browser's confirmation for full page unloads.

**Status:** v1.0 release candidate — browser compatibility verification in progress. Do not publish to Packagist until all release checks pass.

## What it handles

| Navigation or action | Behavior |
| --- | --- |
| Ordinary links and page reload (no Turbo) | Native browser `beforeunload` confirmation |
| Closing a tab or browser | Native `beforeunload` where supported by the browser |
| Turbo Drive links and programmatic `Turbo.visit()` | Confirm before starting the visit |
| Turbo Drive Back/Forward | Confirm and cancel eligible same-document history traversals through the Navigation API |
| Turbo Frames (including programmatic `src` updates) | Confirm before replacing a frame containing an edited form |
| Native successful form submission | No false warning when submitting |
| Turbo form submission | No false warning while submitting; dirty state maintained after an unsuccessful submission where the form is not replaced |
| Reset or revert to the original values | Form becomes clean again |

Changes to standard inputs, checkboxes, radio buttons, selects, textareas, and selected files are tracked by values rather than by a simple "ever touched" flag. A change event is dispatched when the dirty state toggles.

## Installation from GitHub

Until the package is available on Packagist:

```bash
composer config repositories.unsaved-form vcs https://github.com/alkinbg/UnsavedFormBundle.git
composer require 'alkin/unsaved-form-bundle:dev-main'
```

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
    <span hidden data-alkin--unsaved-form-bundle--guard-target="indicator">
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

Turbo restoration visits do not fire `turbo:before-visit`. The bundle uses the standard browser Navigation API for same-document Back/Forward visits where they are cancelable. Older browsers without that support cannot provide exactly the same guarantees. The automated browser tests cover modern Chromium, Firefox, and WebKit.

Turbo Frame navigation is guarded immediately before rendering. When a user declines, the new frame content is not rendered and the frame's `src` is cleared because it no longer represents the visible frame content.

All forms can be explicitly marked clean with `markClean()`. Programmatic changes to field values should dispatch an `input` or `change` event for immediate indicators; navigation always rechecks their actual values. Deliberately replacing a dirty form from arbitrary third-party JavaScript is not a navigation and cannot be prevented without application-specific coordination.

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
