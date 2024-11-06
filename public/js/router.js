export function route(file = null, path = null, js = null) {
    if (file) {
        const loadPage = (page) => {
            document.body = page.getElementsByTagName('body')[0];
            if (js)
                js();
        };
        fetch(`/${file}`).then(async (page) => {
            const pageText = await page.text();
            const html = document.createElement('html');
            html.innerHTML = pageText;
            loadPage(html);
        });
    }
    if (path) {
        const newURL = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}${path}`;
        window.history.replaceState({ path: newURL }, '', newURL);
    }
}
