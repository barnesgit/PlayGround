import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number.parseInt(process.env.PORT || '3000', 10)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
}

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Bad request')
    return
  }

  let file = resolve(root, '.' + pathname)
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  if (!existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }
  if (statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
  response.setHeader('Cache-Control', 'no-cache')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'geolocation=(self)')
  if (request.method === 'HEAD') {
    response.writeHead(200)
    response.end()
    return
  }
  response.writeHead(200)
  createReadStream(file).pipe(response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`GeoKey serving ${root} at http://0.0.0.0:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
