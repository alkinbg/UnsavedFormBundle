import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { Application } from '@hotwired/stimulus';
import { JSDOM } from 'jsdom';
import GuardController from '../assets/dist/controller.js';

const identifier = 'alkin--unsaved-form-bundle--guard';
const formMarkup = `
<form data-controller="${identifier}"
    data-${identifier}-message-value="Leave without saving?">
    <input name="title" value="Original">
    <input type="checkbox" name="visible" value="yes" checked>
    <label><input type="radio" name="size" value="small" checked>Small</label>
    <label><input type="radio" name="size" value="large">Large</label>
    <select name="category"><option value="news">News</option><option value="events">Events</option></select>
    <select name="tags[]" multiple>
        <option value="a" selected>A</option>
        <option value="b">B</option>
    </select>
    <input type="file" name="attachment">
    <input name="ignored" value="Original" data-unsaved-form-ignore>
    <input name="disabled" value="Original" disabled>
    <span data-${identifier}-target="indicator" hidden>Unsaved</span>
    <button type="submit">Save</button>
</form>
`;

let dom;
let application;
let form;
let guard;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function input(name) {
    return form.elements.namedItem(name);
}

function dispatchInput(element, type = 'input') {
    element.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
}

function turboVisit() {
    const event = new dom.window.CustomEvent('turbo:before-visit', {
        bubbles: true,
        cancelable: true,
        detail: { url: 'https://example.test/next' },
    });

    dom.window.document.documentElement.dispatchEvent(event);

    return event;
}

function unloadEvent() {
    const event = new dom.window.Event('beforeunload', { cancelable: true });
    dom.window.dispatchEvent(event);

    return event;
}

beforeEach(async () => {
    dom = new JSDOM(`<!doctype html><html><body>${formMarkup}</body></html>`, {
        url: 'https://example.test/edit',
    });

    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.MutationObserver = dom.window.MutationObserver;
    globalThis.CustomEvent = dom.window.CustomEvent;
    globalThis.Element = dom.window.Element;
    globalThis.Node = dom.window.Node;
    globalThis.HTMLElement = dom.window.HTMLElement;

    application = Application.start();
    application.register(identifier, GuardController);
    await tick();
    form = dom.window.document.querySelector('form');
    guard = application.getControllerForElementAndIdentifier(form, identifier);
    assert.ok(guard, 'Stimulus controller should connect');
});

afterEach(async () => {
    application.stop();
    await tick();
    dom.window.close();

    for (const key of ['window', 'document', 'MutationObserver', 'CustomEvent', 'Element', 'Node', 'HTMLElement']) {
        delete globalThis[key];
    }
});

test('pristine forms are not blocked', () => {
    assert.equal(guard.refresh(), false);
    assert.equal(form.querySelector('span').hidden, true);
    assert.equal(unloadEvent().defaultPrevented, false);
});

test('editing and reverting text toggles the indicator and sends change events', () => {
    const events = [];
    form.addEventListener(`${identifier}:change`, (event) => events.push(event.detail.dirty));
    input('title').value = 'Edited';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), true);
    assert.equal(form.querySelector('span').hidden, false);

    input('title').value = 'Original';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), false);
    assert.equal(form.querySelector('span').hidden, true);
    assert.deepEqual(events, [true, false]);
});

test('checkbox and radio inputs are compared by their real values', () => {
    input('visible').checked = false;
    dispatchInput(input('visible'), 'change');
    assert.equal(guard.refresh(), true);
    input('visible').checked = true;
    dispatchInput(input('visible'), 'change');
    assert.equal(guard.refresh(), false);

    const radios = form.querySelectorAll('[name="size"]');
    radios[0].checked = false;
    radios[1].checked = true;
    dispatchInput(radios[1], 'change');
    assert.equal(guard.refresh(), true);

    radios[1].checked = false;
    radios[0].checked = true;
    dispatchInput(radios[0], 'change');
    assert.equal(guard.refresh(), false);
});

test('single and multiple selects can return to pristine', () => {
    input('category').value = 'events';
    dispatchInput(input('category'), 'change');
    assert.equal(guard.refresh(), true);

    input('category').value = 'news';
    dispatchInput(input('category'), 'change');
    assert.equal(guard.refresh(), false);

    const select = input('tags[]');
    select.options[1].selected = true;
    dispatchInput(select, 'change');
    assert.equal(guard.refresh(), true);

    select.options[1].selected = false;
    dispatchInput(select, 'change');
    assert.equal(guard.refresh(), false);
});

test('ignored and disabled fields do not mark a form dirty', () => {
    input('ignored').value = 'Changed';
    dispatchInput(input('ignored'));
    input('disabled').value = 'Changed';
    dispatchInput(input('disabled'));
    assert.equal(guard.refresh(), false);
});

test('file selections are tracked and can be cleared', () => {
    const fileField = input('attachment');
    Object.defineProperty(fileField, 'files', {
        configurable: true,
        value: [new dom.window.File(['hello'], 'note.txt', { type: 'text/plain' })],
    });
    dispatchInput(fileField, 'change');
    assert.equal(guard.refresh(), true);

    Object.defineProperty(fileField, 'files', { configurable: true, value: [] });
    dispatchInput(fileField, 'change');
    assert.equal(guard.refresh(), false);
});

test('dirty forms prevent native page unload', () => {
    input('title').value = 'Edited';
    assert.equal(unloadEvent().defaultPrevented, true);
    assert.equal(form.querySelector('span').hidden, false);
});

test('declined Turbo Drive visit is cancelled', () => {
    input('title').value = 'Edited';
    let prompts = 0;
    dom.window.confirm = (message) => {
        prompts++;
        assert.equal(message, 'Leave without saving?');
        return false;
    };
    assert.equal(turboVisit().defaultPrevented, true);
    assert.equal(prompts, 1);
});

test('approved Turbo Drive visit proceeds', () => {
    input('title').value = 'Edited';
    dom.window.confirm = () => true;
    assert.equal(turboVisit().defaultPrevented, false);
});

test('two dirty forms prompt only once for a single Turbo visit', async () => {
    dom.window.document.body.insertAdjacentHTML('beforeend', formMarkup);
    await tick();
    const secondForm = dom.window.document.querySelectorAll('form')[1];
    secondForm.querySelector('input[name="title"]').value = 'Changed second';

    input('title').value = 'Changed first';
    let prompts = 0;
    dom.window.confirm = () => { prompts++; return true; };

    assert.equal(turboVisit().defaultPrevented, false);
    assert.equal(prompts, 1);
});

test('browser reset restores the original pristine state', async () => {
    input('title').value = 'Edited';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), true);
    form.reset();
    await tick();
    assert.equal(guard.refresh(), false);
});

test('normal valid form submissions do not warn', async () => {
    input('title').value = 'Edited';
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.equal(unloadEvent().defaultPrevented, false);
});

test('cancelled form submissions remain dirty and warn', async () => {
    input('title').value = 'Edited';
    form.addEventListener('submit', (event) => event.preventDefault());
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.equal(unloadEvent().defaultPrevented, true);
});

test('a failed Turbo form submission retains dirty state', () => {
    input('title').value = 'Edited';
    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-start', { bubbles: true }));
    assert.equal(unloadEvent().defaultPrevented, false);
    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-end', {
        bubbles: true,
        detail: { success: false },
    }));
    assert.equal(unloadEvent().defaultPrevented, true);
});

test('successful Turbo save accepts the current field values as baseline', () => {
    input('title').value = 'Edited';
    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-start', { bubbles: true }));
    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-end', {
        bubbles: true,
        detail: { success: true },
    }));
    assert.equal(guard.refresh(), false);
    assert.equal(unloadEvent().defaultPrevented, false);

    input('title').value = 'Changed again';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), true);
});

test('markClean can be called after custom AJAX saves', () => {
    input('title').value = 'Saved externally';
    assert.equal(guard.refresh(), true);
    guard.markClean();
    assert.equal(guard.refresh(), false);
    assert.equal(unloadEvent().defaultPrevented, false);
});

test('programmatic value changes are detected before navigation', () => {
    input('title').value = 'Programmatic edit without an input event';
    dom.window.confirm = () => false;
    assert.equal(turboVisit().defaultPrevented, true);
});

test('listeners are removed when the form disconnects', async () => {
    input('title').value = 'Edited';
    form.remove();
    await tick();
    assert.equal(unloadEvent().defaultPrevented, false);
});

test('declined Back/Forward popstate is reversed before Turbo sees it', () => {
    dom.window.navigation = { currentEntry: { index: 3 } };
    guard.historyIndex = 2;
    const historyDeltas = [];
    dom.window.history.go = (delta) => historyDeltas.push(delta);
    input('title').value = 'Changed';
    let dialogs = 0;
    dom.window.confirm = () => { dialogs++; return false; };
    let turboPopstates = 0;
    dom.window.addEventListener('popstate', () => { turboPopstates++; });

    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.deepEqual(historyDeltas, [-1]);
    assert.equal(turboPopstates, 0);
    assert.equal(dialogs, 1);

    dom.window.navigation.currentEntry.index = 2;
    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.equal(turboPopstates, 0);
    assert.equal(dialogs, 1);

    dom.window.confirm = () => { dialogs++; return true; };
    dom.window.navigation.currentEntry.index = 3;
    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.equal(turboPopstates, 1);
    assert.equal(dialogs, 2);
});

test('denied backward popstate rolls forward without rendering', () => {
    dom.window.navigation = { currentEntry: { index: 1 } };
    guard.historyIndex = 3;
    const deltas = [];
    dom.window.history.go = (delta) => deltas.push(delta);
    input('title').value = 'Unsaved';
    dom.window.confirm = () => false;
    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.deepEqual(deltas, [2]);
    dom.window.navigation.currentEntry.index = 3;
    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.equal(guard.historyIndex, 3);
});

test('popstate on a clean form does not prompt', () => {
    dom.window.navigation = { currentEntry: { index: 1 } };
    guard.historyIndex = 0;
    dom.window.confirm = () => { throw new Error('Clean forms should not show dialogs'); };
    dom.window.dispatchEvent(new dom.window.Event('popstate'));
    assert.equal(guard.historyIndex, 1);
});

test('Turbo cache restoration keeps the original baseline for dirty forms', async () => {
    input('title').value = 'Unsent draft';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), true);

    document.dispatchEvent(new dom.window.Event('turbo:before-cache'));
    const clone = form.cloneNode(true);
    form.replaceWith(clone);
    await tick();

    const restored = application.getControllerForElementAndIdentifier(clone, identifier);
    assert.ok(restored);
    assert.equal(clone.elements.namedItem('title').value, 'Unsent draft');
    assert.equal(restored.refresh(), true);
    assert.equal(restored.baseline, guard.baseline);
    assert.equal(clone.querySelector('span').hidden, false);
});

test('Turbo 422 response carries dirty baseline into a newly rendered form', async () => {
    form.id = 'edit-form';
    input('title').value = 'Draft invalid';
    dispatchInput(input('title'));
    const original = guard.baseline;

    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-start', { bubbles: true }));
    form.dispatchEvent(new dom.window.CustomEvent('turbo:before-fetch-response', {
        bubbles: true,
        detail: { fetchResponse: { succeeded: false, statusCode: 422 } },
    }));
    form.dispatchEvent(new dom.window.CustomEvent('turbo:submit-end', {
        bubbles: true,
        detail: { success: false },
    }));

    const newBody = dom.window.document.createElement('body');
    newBody.innerHTML = formMarkup.replace('<form ', '<form id="edit-form" ').replace('value="Original"', 'value="Draft invalid"');
    const replacement = newBody.querySelector('form');
    dom.window.document.dispatchEvent(new dom.window.CustomEvent('turbo:before-render', {
        bubbles: true,
        detail: { newBody },
    }));

    assert.equal(replacement.dataset.unsavedFormCacheKey, guard.cacheKey);
    form.replaceWith(replacement);
    await tick();

    const nextController = application.getControllerForElementAndIdentifier(replacement, identifier);
    assert.ok(nextController);
    assert.equal(nextController.baseline, original);
    assert.equal(nextController.refresh(), true);
});

test('Turbo Stream replacement can be declined without losing a dirty form', () => {
    form.id = 'edit-form';
    input('title').value = 'Unsaved';
    let prompts = 0;
    dom.window.confirm = () => { prompts++; return false; };
    const stream = dom.window.document.createElement('turbo-stream');
    stream.setAttribute('action', 'replace');
    Object.defineProperty(stream, 'targetElements', { value: [form] });
    dom.window.document.body.append(stream);
    let replaced = false;
    const event = new dom.window.CustomEvent('turbo:before-stream-render', {
        bubbles: true,
        cancelable: true,
        detail: { render: () => { replaced = true; } },
    });
    stream.dispatchEvent(event);
    event.detail.render();
    assert.equal(replaced, false);
    assert.equal(prompts, 1);
    assert.equal(input('title').value, 'Unsaved');
});

test('Turbo Stream updates not affecting the dirty form do not warn', () => {
    input('title').value = 'Unsaved';
    dom.window.confirm = () => { throw new Error('Unrelated stream should not warn'); };
    const target = dom.window.document.createElement('div');
    dom.window.document.body.append(target);
    const stream = dom.window.document.createElement('turbo-stream');
    stream.setAttribute('action', 'update');
    Object.defineProperty(stream, 'targetElements', { value: [target] });
    dom.window.document.body.append(stream);
    let rendered = false;
    const event = new dom.window.CustomEvent('turbo:before-stream-render', {
        bubbles: true,
        cancelable: true,
        detail: { render: () => { rendered = true; } },
    });
    stream.dispatchEvent(event);
    event.detail.render();
    assert.equal(rendered, true);
});

test('Turbo Frame refuses replacing a dirty form without hanging rendering', async () => {
    const frame = dom.window.document.createElement('turbo-frame');
    frame.id = 'editor';
    form.before(frame);
    frame.append(form);
    await tick();
    guard = application.getControllerForElementAndIdentifier(form, identifier);
    assert.ok(guard);

    input('title').value = 'Dirty frame';
    frame.setAttribute('src', '/other');
    dom.window.confirm = () => false;
    let didRender = false;
    const event = new dom.window.CustomEvent('turbo:before-frame-render', {
        cancelable: true,
        bubbles: true,
        detail: { render: () => { didRender = true; } },
    });
    frame.dispatchEvent(event);
    event.detail.render();
    assert.equal(didRender, false);
    assert.equal(form.isConnected, true);
    assert.equal(input('title').value, 'Dirty frame');
    assert.equal(frame.hasAttribute('src'), false);
});

test('Turbo Frame visits outside the dirty form do not prompt', () => {
    const otherFrame = dom.window.document.createElement('turbo-frame');
    dom.window.document.body.append(otherFrame);
    input('title').value = 'Dirty';
    dom.window.confirm = () => { throw new Error('Unrelated frame must not warn'); };
    const renderer = () => {};
    const event = new dom.window.CustomEvent('turbo:before-frame-render', {
        cancelable: true,
        bubbles: true,
        detail: { render: renderer },
    });
    otherFrame.dispatchEvent(event);
    assert.equal(event.detail.render, renderer);
});

test('Turbo cache restoration retains previously edited values', async () => {
    const cached = form.cloneNode(true);
    input('title').value = 'Unsaved draft';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), true);
    assert.equal(cached.elements.namedItem('title').value, 'Original');

    form.replaceWith(cached);
    await tick();
    const replacementController = application.getControllerForElementAndIdentifier(cached, identifier);
    assert.ok(replacementController);
    assert.equal(cached.elements.namedItem('title').value, 'Unsaved draft');
    assert.equal(replacementController.refresh(), true);
});

test('reverting changes clears the draft before Turbo restores the form', async () => {
    const cached = form.cloneNode(true);
    input('title').value = 'Temporary';
    dispatchInput(input('title'));
    input('title').value = 'Original';
    dispatchInput(input('title'));
    assert.equal(guard.refresh(), false);

    form.replaceWith(cached);
    await tick();
    const replacementController = application.getControllerForElementAndIdentifier(cached, identifier);
    assert.ok(replacementController);
    assert.equal(cached.elements.namedItem('title').value, 'Original');
    assert.equal(replacementController.refresh(), false);
});
