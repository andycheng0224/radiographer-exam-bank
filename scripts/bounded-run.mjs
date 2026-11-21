import { spawn } from 'node:child_process'
const [secondsText, command, ...args] = process.argv.slice(2)
const seconds = Number(secondsText)
if (!command || !Number.isFinite(seconds) || seconds < 1) throw new Error('Usage: node scripts/bounded-run.mjs seconds command [...args]')
const child = spawn(command, args, { stdio: 'inherit', detached: process.platform !== 'win32', env: { ...process.env, UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || '64' } })
let timedOut = false
const stop = () => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL') } catch {} }
const timer = setTimeout(() => { timedOut = true; console.error(`[deadline] ${command} exceeded ${seconds}s; stopped process group. This is NOT a passing check.`); stop() }, seconds * 1000)
child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { clearTimeout(timer); process.exitCode = timedOut ? 124 : code ?? 1 })
process.on('SIGINT', () => { stop(); process.exitCode = 130 })
