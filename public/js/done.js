export function main() {
    const testName = document.getElementById('test-name');
    const domain = document.getElementById('domain');
    const configStr = localStorage.getItem('config');
    if (configStr) {
        try {
            const config = JSON.parse(configStr);
            testName.innerHTML = config.name;
        }
        catch {
        }
    }
    const url = `${window.location.origin}/results`;
    domain.innerHTML = url;
    domain.href = url;
}
