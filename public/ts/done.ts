import { TestConfig } from "./types/index";

export function main() {
  const testName = document.getElementById('test-name')!;
  const domain = document.getElementById('domain') as HTMLAnchorElement;

  const configStr = localStorage.getItem('config');
  if (configStr) {
    try {
      const config: TestConfig = JSON.parse(configStr);
      testName.innerHTML = config.name;
    } catch {

    }
  }

  const url = `${window.location.origin}/results`;
  domain.innerHTML = url;
  domain.href = url;
}