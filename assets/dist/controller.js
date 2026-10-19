import { Controller } from '@hotwired/stimulus';

// A single Turbo visit may encounter several dirty forms. Ask only once.
const approvedVisits = new WeakSet();

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
        this.onBeforeUnload = this.onBeforeUnload.bind(this);
    }

    connect() {
        if (this.element.tagName !== 'FORM') {
            throw new TypeError('Unsaved Form must be attached to a <form> element.');
        }

        this.baseline = this.snapshot();
        this.dirty = false;
        this.submitting = false;
        this.showStatus();

        this.element.addEventListener('input', this.onFormChange);
        this.element.addEventListener('change', this.onFormChange);
        this.element.addEventListener('reset', this.onFormReset);
        this.element.addEventListener('submit', this.onFormSubmit);
        this.element.addEventListener('turbo:submit-start', this.onTurboSubmitStart);
        this.element.addEventListener('turbo:submit-end', this.onTurboSubmitEnd);
        this.element.ownerDocument.addEventListener('turbo:before-visit', this.onTurboBeforeVisit);
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
