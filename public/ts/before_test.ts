import { TestConfig } from "./types/index";
import { route } from './router.js';
import { main as entry } from './entry.js';
import { main as test } from './index.js';

export function main() {
  const name = document.getElementById('name')!;
  const description = document.getElementById('description')!;
  const begin = document.getElementById('begin') as HTMLButtonElement;
  const back = document.getElementById('back') as HTMLButtonElement;

  const configStr = localStorage.getItem('config')
  if (!configStr) {
    return route('entry.html', '/entry', entry);
  }

  let config: TestConfig;
  try {
    config = JSON.parse(configStr);
  } catch {
    localStorage.clear();
    return route('entry.html', '/entry', entry);
  }

  name.innerHTML = config.name;
  description.innerHTML = config.description;

  back.onclick = () => {
    route('entry.html', '/entry', entry);
  }

  begin.onclick = () => {
    document.documentElement.requestFullscreen().catch(() => {});
    route('test.html', `/${config.id}`, test);
  }
}