// Runs the API and the web app together for local development.
import { spawn } from 'node:child_process';
const run = (script) => spawn('npm', ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
const procs = [run('dev:api'), run('dev:web')];
const stop = () => procs.forEach(p => p.kill());
process.on('SIGINT', stop); process.on('SIGTERM', stop);
