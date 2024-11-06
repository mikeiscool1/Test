import './events.js';
import { Module, TestConfig } from "./types/index";
import { Test } from "./Test.js";
import { main as entry } from './entry.js';
import { route } from './router.js';

export function main() {
  const configStr = localStorage.getItem('config');
  const ticket = localStorage.getItem('ticket');
  if (!configStr) return route('entry.html', '/entry', entry);
  if (!ticket) return route('entry.html', '/entry', entry);

  const config: TestConfig = JSON.parse(configStr);
  if (config.id !== window.location.pathname.slice(1)) return route('entry.html', '/entry', entry);

  const test = new Test();
  test.begin(config.id, ticket);
}