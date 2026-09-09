import { readdir, readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'

async function sourceFiles(dir) {
  const files = []
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (['data', 'uploads'].includes(item.name)) continue
    const name = `${dir}/${item.name}`
    if (item.isDirectory()) files.push(...await sourceFiles(name))
    else if (/\.(mjs|js|jsx)$/.test(name)) files.push(name)
  }
  return files
}
const files = [...await sourceFiles('src'), ...await sourceFiles('scripts'), ...await sourceFiles('tests'),
  'vite.config.js', 'postcss.config.js', 'tailwind.config.js']
for (const filename of files) {
  await transformWithOxc(await readFile(filename, 'utf8'), filename, { jsx: { runtime: 'automatic' } })
}
console.log(`Syntax check passed: ${files.length} JS / JSX source and test files`)
