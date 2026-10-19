const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { setTimeout: pause } = require('node:timers/promises');
const { chromium, firefox, webkit } = require('playwright');

const browserName = process.env.UNSAVED_BROWSER || 'chromium';
const port = Number(process.env.UNSAVED_BROWSER_PORT || 8124);
const base = 'http://127.0.0.1:' + port;
const browsers = { chromium, firefox, webkit };
let failures = 0;

async function visit(page, pathname, formSelector = '#edit-form') {
    await page.goto(base + pathname);
    await page.waitForFunction(
        (selector) => {
            const form = document.querySelector(selector);
            return !!form && !!window.application?.getControllerForElementAndIdentifier(form, 'guard');
        },
        formSelector,
    );
}

async function main() {
    const fixture = spawn(process.execPath, [require.resolve('./server.cjs')], {
        stdio: 'pipe',
        env: { ...process.env, UNSAVED_BROWSER_PORT: String(port) },
    });
    let fixtureErr = '';
    fixture.stderr.on('data', (data) => { fixtureErr += String(data); });

    try {
        let healthy = false;
        for (let attempt = 0; attempt < 50; attempt++) {
            try {
                const response = await fetch(base + '/edit');
                if (response.ok) {
                    healthy = true;
                    break;
                }
            } catch {}
            await pause(100);
        }
        assert.equal(healthy, true, 'HTTP fixture server must start: ' + fixtureErr);

        const options = { headless: true };
        if (browserName === 'chromium' && process.env.UNSAVED_CHROMIUM_EXECUTABLE) {
            options.executablePath = process.env.UNSAVED_CHROMIUM_EXECUTABLE;
        }
        const browser = await browsers[browserName].launch(options);

        try {
            async function run(name, execute) {
                const page = await browser.newPage();
                page.setDefaultTimeout(5000);
                const dialogs = [];
                let approve = false;
                page.on('dialog', async (dialog) => {
                    dialogs.push(dialog.type());
                    if (approve) await dialog.accept();
                    else await dialog.dismiss();
                });

                try {
                    await execute({
                        page,
                        dialogs,
                        approve: () => { approve = true; },
                    });
                    console.log('PASS [' + browserName + '] ' + name);
                } catch (error) {
                    failures++;
                    console.error('FAIL [' + browserName + '] ' + name + '\n' + error.stack);
                } finally {
                    await page.close();
                }
            }

            await run('Turbo Drive: blocked and approved visits', async ({ page, dialogs, approve }) => {
                await visit(page, '/edit');
                await page.locator('#edit-form input').fill('Edited');
                await page.locator('#nav').click();
                await pause(150);
                assert.equal(new URL(page.url()).pathname, '/edit');
                assert.equal(dialogs.length, 1);
                assert.equal(await page.locator('#edit-form input').inputValue(), 'Edited');

                approve();
                await page.locator('#nav').click();
                await page.waitForURL('**/other');
                assert.equal(await page.locator('h1').first().textContent(), 'OTHER');
            });

            await run('Turbo Back/Forward: canceled traversal preserves draft and URL', async ({ page, dialogs, approve }) => {
                await visit(page, '/edit');
                await page.locator('#nav').click();
                await page.waitForURL('**/other');
                await page.goBack();
                await page.waitForURL('**/edit');
                await page.waitForFunction(() => !!window.application?.getControllerForElementAndIdentifier(document.querySelector('#edit-form'), 'guard'));
                await page.locator('#edit-form input').fill('Dirty after back');

                await page.evaluate(() => history.forward());
                await pause(350);

                assert.equal(new URL(page.url()).pathname, '/edit');
                assert.equal(await page.locator('#edit-form input').inputValue(), 'Dirty after back');
                assert.equal(dialogs.length, 1);

                approve();
                // Retry through the browser History API after declining once.
                // This exposes WebKit cancellation bugs that Navigation API-only
                // checks miss.
                await page.evaluate(() => history.forward());
                await page.waitForURL('**/other');
                // URL changes before Turbo finishes its popstate handling.
                // Wait for the prompt and the destination DOM, not only the URL.
                for (let n = 0; n < 50 && dialogs.length < 2; n++) await pause(20);
                assert.equal(dialogs.length, 2);
                await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'OTHER');
            });

            await run('Turbo Back: rejected then accepted without losing edits', async ({ page, dialogs, approve }) => {
                await visit(page, '/edit');
                await page.locator('#nav').click();
                await page.waitForURL('**/other');
                await page.locator('#return').click();
                await page.waitForURL('**/edit');
                await page.waitForFunction(() => !!window.application?.getControllerForElementAndIdentifier(document.querySelector('#edit-form'), 'guard'));
                await page.locator('#edit-form input').fill('Dirty when going Back');

                await page.evaluate(() => history.back());
                await pause(350);
                assert.equal(new URL(page.url()).pathname, '/edit');
                assert.equal(await page.locator('#edit-form input').inputValue(), 'Dirty when going Back');
                assert.equal(dialogs.length, 1);

                approve();
                await page.evaluate(() => history.back());
                await page.waitForURL('**/other');
                for (let n = 0; n < 50 && dialogs.length < 2; n++) await pause(20);
                assert.equal(dialogs.length, 2);
                await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'OTHER');
            });

            await run('Turbo Frame: click navigation can be declined then accepted', async ({ page, dialogs, approve }) => {
                await visit(page, '/edit');
                await page.locator('#frame-form input').waitFor();
                await page.locator('#frame-form input').fill('Frame edit');
                await page.locator('#frame-next').click();
                await pause(200);
                assert.equal(await page.locator('#frame-form input').inputValue(), 'Frame edit');
                assert.equal(await page.locator('#frame-result').count(), 0);
                assert.equal(dialogs.length, 1);

                approve();
                await page.locator('#frame-next').click();
                await page.locator('#frame-result').waitFor();
                assert.equal(dialogs.length, 2);
            });

            await run('Turbo Frame: programmatic src navigation can be declined', async ({ page, dialogs }) => {
                await visit(page, '/edit');
                await page.locator('#frame-form input').waitFor();
                await page.locator('#frame-form input').fill('Programmatic frame edit');
                await page.locator('#program-frame').click();
                await pause(200);

                assert.equal(new URL(page.url()).pathname, '/edit');
                assert.equal(await page.locator('#frame-form input').inputValue(), 'Programmatic frame edit');
                assert.equal(await page.locator('#frame-result').count(), 0);
                assert.equal(dialogs.length, 1);
            });

            await run('Turbo-disabled link: native beforeunload is invoked', async ({ page, dialogs, approve }) => {
                await visit(page, '/edit');
                await page.locator('#edit-form input').fill('Native dirty');
                await page.locator('#hard').click({ noWaitAfter: true });
                await pause(200);
                assert.equal(new URL(page.url()).pathname, '/edit');
                assert.equal(dialogs.length, 1);
                assert.equal(dialogs[0], 'beforeunload');

                approve();
                await page.locator('#hard').click({ noWaitAfter: true });
                await page.waitForURL('**/other');
            });

            await run('Without Turbo: native navigation is guarded', async ({ page, dialogs, approve }) => {
                await visit(page, '/plain-edit');
                assert.equal(await page.evaluate(() => !!window.Turbo), false);
                await page.locator('#edit-form input').fill('Plain dirty');
                await page.locator('#nav').click({ noWaitAfter: true });
                await pause(200);
                assert.equal(new URL(page.url()).pathname, '/plain-edit');
                assert.equal(dialogs[0], 'beforeunload');

                approve();
                await page.locator('#nav').click({ noWaitAfter: true });
                await page.waitForURL('**/other');
            });

            await run('Without Turbo: native successful form submission does not warn', async ({ page, dialogs }) => {
                await visit(page, '/plain-edit');
                await page.locator('#edit-form input').fill('Ready for save');
                await page.locator('#save').click({ noWaitAfter: true });
                await page.waitForURL('**/saved');
                assert.deepEqual(dialogs, []);
            });

            await run('With Turbo: successful form submission does not warn', async ({ page, dialogs }) => {
                await visit(page, '/edit');
                await page.locator('#edit-form input').fill('Ready for save');
                await page.locator('#edit-form #save').click();
                await page.waitForURL('**/saved');
                assert.deepEqual(dialogs, []);
            });
        } finally {
            await browser.close();
        }
    } finally {
        fixture.kill();
    }

    if (failures > 0) {
        throw new Error(failures + ' browser scenarios failed in ' + browserName);
    }
}

main().catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
});
