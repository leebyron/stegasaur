import { readFile } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export async function serve(
  dir = dirname(fileURLToPath(import.meta.url)),
  port = 3000
) {
  const server = createServer((request, response) => {
    const filePath = join(dir, request.url === '/' ? 'index.html' : request.url)

    readFile(filePath, (error, content) => {
      const contentType = extname(filePath).endsWith('js')
        ? 'text/javascript'
        : 'text/html'
      response.writeHead(error ? (error.code === 'ENOENT' ? 404 : 500) : 200, {
        'Content-Type': contentType,
      })
      response.end(error ?? content, 'utf-8')
    })
  })

  server.keepAliveTimeout = 500

  await promisify(server.listen).call(server, port)
  console.log(`Serving ${dir} at http://localhost:${port}/`)
  return async () => {
    await promisify(server.close).call(server)
    console.log('Server closed')
  }
}

// TODO: remove once this is used more directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const close = await serve()
  await close()
}
