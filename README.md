# Unsaved Form Bundle

A small, independent Symfony UX experiment: warn users if they try to leave a form with unsaved edits.

**Status:** prototype. Not a stable release or an official Symfony component. No Packagist publication yet.

## Why?

Editable forms are common. Implementing change detection, a warning on ordinary navigation, a warning on Turbo Drive navigation, and correct handling of successful/failed form submission is easy to repeat across projects and surprisingly easy to get wrong.

This bundle provides **one Stimulus controller**. It does not introduce PHP services, database tables, or custom form types.

## Supported behavior

- Detects changes to text inputs, selects, checkboxes, radio groups, textareas, and file input selections.
- Recognizes when a field is changed *back* to its original value.
- Warns with the browser's built-in confirmation on reload, hard navigation, or tab close (when browser policy allows).
- Confirms cancellable Turbo Drive application visits.
- Does not warn for an ordinary valid form submission; restores the dirty state after a failed Turbo submission.
- Resets the saved baseline after a successful Turbo submission, or when you call `markClean()`.
- Optional dirty-state indicator, emitted change event, and `data-unsaved-form-ignore` attribute.

## Install for testing from GitHub

Once this repository is public, test the unreleased code with a VCS repository:

```bash
composer config repositories.unsaved-form vcs https://github.com/alkinbg/UnsavedFormBundle.git
composer require 'alkin/unsaved-form-bundle:dev-main'
```

The application needs Symfony StimulusBundle and a configured frontend pipeline such as AssetMapper. Symfony Flex registers the bundle and its controller; **verify** `config/bundles.php` and `assets/controllers.json`. It is not yet distributed through Packagist.

Use the provided controller on a Symfony Form:

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

Or add the controller directly to an HTML form:

```html
<form data-controller="alkin--unsaved-form-bundle--guard">
  <input name="title" value="Example">
  <button type="submit">Save</button>
</form>
```

To ignore a field or wrapper:

```html
<input name="client-only" data-unsaved-form-ignore>
```

If you save a form through custom JavaScript without Turbo, call `controller.markClean()` after a **confirmed successful save**. Programmatic field updates should dispatch an `input` or `change` event to update the indicator; navigation still re-checks actual field values.

## Important limitations

- Turbo **Back/Forward (restoration visits)** do not emit `turbo:before-visit` and cannot be canceled by that event. This prototype deliberately does **not** claim to guard those visits.
- Turbo Frame navigation is not covered; only Turbo Drive visits and browser navigation are handled.
- Native `beforeunload` prompts are browser-controlled, may require prior user interaction, and cannot use a custom message.
- Fields added after connection participate in later comparisons. Purely visual changes and unnamed/disabled controls are ignored.
- When several dirty forms share a page, one Turbo visit prompts only once. Native `beforeunload` may still involve multiple handlers, depending on the browser.
- If your app replaces form content with Turbo Streams or DOM morphing, you must deliberately choose when to reset the saved baseline.
- No autosave, automatic form submission, persistent data storage, or server-side form modifications.

## Development

```bash
composer validate --strict
npm ci
npm test
```

The tests exercise the Stimulus controller with jsdom; browser and Turbo integration are still considered experimental.

## License

MIT.
