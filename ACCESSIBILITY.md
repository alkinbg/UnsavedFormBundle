# Accessibility

Unsaved Form Bundle has no independent visual design system. It exposes a Stimulus controller, optional dirty-state indicators, and confirmation dialogs.

- Ordinary page unloads use the **browser's native confirmation**. Browsers control the wording and accessibility behavior.
- Turbo navigation uses the browser's `window.confirm()` dialog, which is similarly browser-controlled.
- An optional `indicator` target can reveal an "Unsaved changes" message. The integrating application is responsible for appropriate semantics, labeling, focus handling, and color contrast.
- The bundle does not alter form labels, error messages, validation markup, or keyboard navigation.

In a Symfony template, an indicator can use `role="status"` and `aria-live="polite"`; assistive-technology announcements should still be tested in the application.

To report an accessibility issue affecting **this bundle's behavior**, open an [issue](https://github.com/alkinbg/UnsavedFormBundle/issues/new/choose). Include the browser, operating system, assistive technology if relevant, and minimal steps to reproduce. Do not include personal form data.
