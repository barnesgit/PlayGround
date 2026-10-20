import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src')
const output = join(root, 'dist')

rmSync(output, { recursive: true, force: true })
mkdirSync(output, { recursive: true })
cpSync(source, output, { recursive: true })
writeFileSync(
  join(output, 'build.json'),
  JSON.stringify({ project: root, builtAt: new Date().toISOString() }, null, 2) + '\n'
)

console.log(`Built ${source} -> ${output}`)
