const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.UNSAVED_BROWSER_PORT || 8124);
const root = __dirname;

function layout(body, turbo = true) {
    const file = turbo ? 'client.bundle.js' : 'plain.bundle.js';

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Unsaved Form Browser Test</title>
    <script type="module" src="/${file}" data-turbo-track="reload"></script>
</head>
<body>${body}</body>
</html>`;
}

function form(id = 'edit-form', values = { title: 'Original' }) {
    return `<form id="${id}" data-controller="guard" data-guard-message-value="Leave without saving?" action="/submit" method="post">
        <label>Title<input type="text" name="title" value="${values.title}"></label>
        <button type="submit" id="save">Save</button>
    </form>`;
}

function edit(turbo = true) {
    return layout(`<h1>EDIT</h1>
        ${form()}
        <nav>
            <a href="/other" id="nav">Turbo navigation</a>
            <a href="/other" id="hard" data-turbo="false">Native navigation</a>
        </nav>
        ${turbo ? '<turbo-frame id="editor" src="/frame"></turbo-frame>' : ''}
    `, turbo);
}

function frame() {
    return `<turbo-frame id="editor">
        ${form('frame-form', { title: 'Frame Original' })}
        <a id="frame-next" href="/frame2">Next frame</a>
        <button id="program-frame" type="button" onclick="document.getElementById('editor').src='/frame2'">Change src</button>
    </turbo-frame>`;
}

const routes = new Map([
    ['/edit', () => edit(true)],
    ['/plain-edit', () => edit(false)],
    ['/other', () => layout('<h1>OTHER</h1><a id="return" href="/edit">Edit</a>')],
    ['/plain-other', () => layout('<h1>PLAIN OTHER</h1>', false)],
    ['/frame', frame],
    ['/frame2', () => '<turbo-frame id="editor"><h2 id="frame-result">New frame</h2></turbo-frame>'],
    ['/saved', () => layout('<h1>SAVED</h1>')],
]);

http.createServer((request, response) => {
    if (request.url.endsWith('.bundle.js')) {
        const file = path.join(root, path.basename(request.url));
        response.setHeader('Content-Type', 'text/javascript');
        response.end(fs.readFileSync(file));
        return;
    }

    if (request.url === '/submit' && request.method === 'POST') {
        request.resume();
        response.writeHead(303, { Location: '/saved' });
        response.end();
        return;
    }

    const route = routes.get(new URL(request.url, 'http://localhost').pathname);
    if (!route) {
        response.writeHead(404);
        response.end('Not Found');
        return;
    }

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(route());
}).listen(port, '127.0.0.1', () => {
    console.log('Unsaved Form browser fixture at http://127.0.0.1:' + port);
});
