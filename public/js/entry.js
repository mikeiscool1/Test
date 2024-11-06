import { route } from "./router.js";
import { main as beforeTest } from './before_test.js';
import { main as test } from './index.js';
import { main as results } from './results.js';
export function main() {
    const enterBtn = document.getElementById('enter');
    const id = document.getElementById('test-id');
    const ticketElement = document.getElementById('ticket');
    const errMsg = document.getElementById('error-message');
    route(null, '/entry');
    async function checkCurrent() {
        const configStr = localStorage.getItem('config');
        if (!configStr)
            return;
        let config = null;
        if (configStr) {
            try {
                config = JSON.parse(configStr);
            }
            catch {
                localStorage.clear();
            }
        }
        if (!config)
            return;
        const ticket = localStorage.getItem('ticket');
        if (!ticket)
            return false;
        const req = await fetch(`/api/${config.id}/current`, {
            headers: {
                'Authorization': ticket
            }
        });
        if (!req.ok) {
            if (req.status === 403) {
                const res = await req.json();
                if (res.code === 1 || res.code === 0) {
                    if (id.value)
                        localStorage.setItem('test_id', id.value);
                    route('results.html', '/results', results);
                    return true;
                }
            }
            id.value = config.id;
            ticketElement.value = ticket;
            localStorage.clear();
            return false;
        }
        const res = await req.json();
        localStorage.setItem('module', JSON.stringify(res.module));
        if (res.refresh_start_time)
            localStorage.setItem('start_module_time', Date.now().toString());
        route('test.html', `/${config.id}`, test);
        return true;
    }
    checkCurrent();
    enterBtn.addEventListener('click', async (e) => {
        if (!id.value)
            return errMsg.innerHTML = 'Test ID is a required field.';
        if (!ticketElement.value)
            return errMsg.innerHTML = 'Ticket is a required field.';
        const req = await fetch(`/api/${id.value}`, {
            headers: {
                'Authorization': ticketElement.value
            }
        });
        const res = await req.json();
        if (!req.ok) {
            localStorage.setItem('config', JSON.stringify({ id: id.value }));
            localStorage.setItem('ticket', ticketElement.value);
            if (await checkCurrent())
                return;
            errMsg.innerHTML = res.message;
            return;
        }
        const { config } = res;
        localStorage.setItem('config', JSON.stringify(config));
        localStorage.setItem('ticket', ticketElement.value);
        route('before_test.html', null, beforeTest);
    });
}
window.onload = main;
