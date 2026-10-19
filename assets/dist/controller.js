import { Controller } from '@hotwired/stimulus';

// A single Turbo visit may encounter several dirty forms. Ask only once.
const approvedVisits = new WeakSet();
// A denied popstate is undone before Turbo's own popstate listener runs.
// Swallow the compensating popstate as well: Turbo has not left the original page.
let expectedRollbackIndex = null;
// Turbo caches cloned form nodes. Keep the original comparison baseline in
// memory so a restored dirty form does not incorrectly become pristine.
const cachedBaselines = new Map();
let nextCacheKey = 0;

export default class extends Controller {
    static targets = ['indicator'];

    static values = {
        message: {
            type: String,
            default: 'You have unsaved changes. Leave this page?',
        },
    };

    initialize() {
        this.onFormChange = this.onFormChange.bind(this);
        this.onFormReset = this.onFormReset.bind(this);
        this.onFormSubmit = this.onFormSubmit.bind(this);
        this.onTurboSubmitStart = this.onTurboSubmitStart.bind(this);
        this.onTurboSubmitEnd = this.onTurboSubmitEnd.bind(this);
        this.onTurboBeforeVisit = this.onTurboBeforeVisit.bind(this);
        this.onTurboBeforeCache = this.onTurboBeforeCache.bind(this);
        this.onPopState = this.onPopState.bind(this);
        this.onTurboBeforeFrameRender = this.onTurboBeforeFrameRender.bind(this);
        this.onBeforeUnload = this.onBeforeUnload.bind(this);
    }

    connect() {
        if (this.element.tagName !== 'FORM') {
            throw new TypeError('Unsaved Form must be attached to a <form> element.');
        }

        this.historyIndex = this.element.ownerDocument.defaultView.navigation?.currentEntry?.index ?? null;
        this.cacheKey = this.element.dataset.unsavedFormCacheKey || `unsaved-form-${++nextCacheKey}`;
        this.element.dataset.unsavedFormCacheKey = this.cacheKey;
        this.baseline = cachedBaselines.get(this.cacheKey) ?? this.snapshot();
        cachedBaselines.set(this.cacheKey, this.baseline);
        this.dirty = this.snapshot() !== this.baseline;
        this.submitting = false;
        this.showStatus();

        this.element.addEventListener('input', this.onFormChange);
        this.element.addEventListener('change', this.onFormChange);
        this.element.addEventListener('reset', this.onFormReset);
        this.element.addEventListener('submit', this.onFormSubmit);
        this.element.addEventListener('turbo:submit-start', this.onTurboSubmitStart);
        this.element.addEventListener('turbo:submit-end', this.onTurboSubmitEnd);
        this.element.ownerDocument.addEventListener('turbo:before-visit', this.onTurboBeforeVisit);
        this.element.ownerDocument.addEventListener('turbo:before-cache', this.onTurboBeforeCache);
        this.element.ownerDocument.addEventListener('turbo:before-frame-render', this.onTurboBeforeFrameRender, true);
        this.element.ownerDocument.defaultView.addEventListener('popstate', this.onPopState, true);
        this.element.ownerDocument.defaultView.addEventListener('beforeunload', this.onBeforeUnload);
    }

    disconnect() {
        this.element.removeEventListener('input', this.onFormChange);
        this.element.removeEventListener('change', this.onFormChange);
        this.element.removeEventListener('reset', this.onFormReset);
        this.element.removeEventListener('submit', this.onFormSubmit);
        this.element.removeEventListener('turbo:submit-start', this.onTurboSubmitStart);
        this.element.removeEventListener('turbo:submit-end', this.onTurboSubmitEnd);
        this.element.ownerDocument.removeEventListener('turbo:before-visit', this.onTurboBeforeVisit);
        this.element.ownerDocument.removeEventListener('turbo:before-cache', this.onTurboBeforeCache);
        this.element.ownerDocument.removeEventListener('turbo:before-frame-render', this.onTurboBeforeFrameRender, true);
        this.element.ownerDocument.defaultView.removeEventListener('popstate', this.onPopState, true);
        this.element.ownerDocument.defaultView.removeEventListener('beforeunload', this.onBeforeUnload);
    }

    onFormChange() {
        this.refresh();
    }

    onFormReset() {
        // The browser restores values after dispatching the reset event.
        queueMicrotask(() => this.refresh());
    }

    onFormSubmit(event) {
        // Wait for other submit handlers to call preventDefault() if necessary.
        queueMicrotask(() => {
            this.submitting = !event.defaultPrevented;
        });
    }

    onTurboSubmitStart(event) {
        if (event.target === this.element) {
            this.submitting = true;
        }
    }

    onTurboSubmitEnd(event) {
        if (event.target !== this.element) {
            return;
        }

        this.submitting = false;

        if (event.detail?.success === true) {
            this.markClean();
        } else {
            this.refresh();
        }
    }

    onTurboBeforeVisit(event) {
        if (event.defaultPrevented || this.submitting || !this.refresh()) {
            return;
        }

        if (approvedVisits.has(event)) {
            return;
        }

        if (!this.element.ownerDocument.defaultView.confirm(this.messageValue)) {
            event.preventDefault();
            return;
        }

        approvedVisits.add(event);
    }

    onTurboBeforeCache() {
        cachedBaselines.set(this.cacheKey, this.baseline);
    }

    onPopState(event) {
        // Turbo Drive handles restoration visits on popstate. We run in capture
        // phase so a declined traversal can be reversed BEFORE Turbo starts it.
        // Unlike Navigation API preventDefault(), this also permits a later
        // Back/Forward retry in WebKit.
        const win = this.element.ownerDocument.defaultView;
        const currentIndex = win.navigation?.currentEntry?.index;
        if (!Number.isInteger(currentIndex)) {
            return;
        }

        if (expectedRollbackIndex !== null && currentIndex === expectedRollbackIndex) {
            expectedRollbackIndex = null;
            this.historyIndex = currentIndex;
            event.stopImmediatePropagation();
            return;
        }

        if (!Number.isInteger(this.historyIndex) || currentIndex === this.historyIndex) {
            this.historyIndex = currentIndex;
            return;
        }

        if (this.submitting || !this.refresh() || approvedVisits.has(event)) {
            this.historyIndex = currentIndex;
            return;
        }

        if (win.confirm(this.messageValue)) {
            approvedVisits.add(event);
            this.historyIndex = currentIndex;
            return;
        }

        const delta = this.historyIndex - currentIndex;
        expectedRollbackIndex = this.historyIndex;
        event.stopImmediatePropagation();
        win.history.go(delta);
    }

    onTurboBeforeFrameRender(event) {
        // Only warn when the form is *inside* the frame being replaced.
        // Frame replacements elsewhere must not block editing this form.
        if (
            event.defaultPrevented ||
            !event.target.contains(this.element) ||
            this.submitting ||
            !this.refresh() ||
            approvedVisits.has(event)
        ) {
            return;
        }

        if (this.element.ownerDocument.defaultView.confirm(this.messageValue)) {
            approvedVisits.add(event);
            return;
        }

        // Turbo's documented custom renderer hook lets the request finish
        // without replacing the dirty form. Do not leave the visit suspended.
        event.detail.render = () => {};
        // The frame's src already points to the refused destination. Clear it
        // so it does not misleadingly report content from that URL.
        event.target.removeAttribute('src');
    }

    onBeforeUnload(event) {
        if (this.submitting || !this.refresh()) {
            return;
        }

        event.preventDefault();
        // Required for the native confirmation dialog in some browsers.
        event.returnValue = '';
    }

    // Applications using AJAX without Turbo can call this after a confirmed save.
    markClean() {
        this.baseline = this.snapshot();
        cachedBaselines.set(this.cacheKey, this.baseline);
        this.submitting = false;
        this.refresh();
    }

    refresh() {
        const nextDirty = this.snapshot() !== this.baseline;

        if (nextDirty !== this.dirty) {
            this.dirty = nextDirty;
            this.showStatus();
            this.dispatch('change', { detail: { dirty: nextDirty } });
        }

        return this.dirty;
    }

    showStatus() {
        this.indicatorTargets.forEach((target) => {
            target.hidden = !this.dirty;
        });
    }

    snapshot() {
        const values = [];

        for (const control of this.element.elements) {
            if (!control.name || control.disabled || control.closest('[data-unsaved-form-ignore]')) {
                continue;
            }

            if (control.tagName === 'INPUT') {
                if (['submit', 'button', 'reset', 'image'].includes(control.type)) {
                    continue;
                }

                if (['radio', 'checkbox'].includes(control.type) && !control.checked) {
                    continue;
                }

                if (control.type === 'file') {
                    for (const file of control.files ?? []) {
                        values.push([control.name, file.name, file.size, file.lastModified, file.type]);
                    }
                    continue;
                }
            } else if (control.tagName === 'SELECT' && control.multiple) {
                for (const option of control.selectedOptions) {
                    if (!option.disabled) {
                        values.push([control.name, option.value]);
                    }
                }
                continue;
            } else if (control.tagName !== 'SELECT' && control.tagName !== 'TEXTAREA') {
                continue;
            }

            values.push([control.name, control.value]);
        }

        return JSON.stringify(values);
    }
}
