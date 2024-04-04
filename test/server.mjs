import { readFile } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export async function serve(
  dir = dirname(fileURLToPath(import.meta.url)),
  port = 3000
) {
  const server = createServer(
    { keepAliveTimeout: 100 },
    (request, response) => {
      const filePath = join(
        dir,
        request.url === '/' ? 'index.html' : request.url
      )

      readFile(filePath, (error, content) => {
        const code = error ? (error.code === 'ENOENT' ? 404 : 500) : 200
        const headers = {
          'Content-Type':
            !error && extname(filePath).endsWith('js')
              ? 'text/javascript'
              : 'text/html',
        }
        console.log('Serve:', filePath, code, headers)
        response.writeHead(code, headers)
        response.end(error ? error.message : content, 'utf-8')
      })
    }
  )

  await promisify(server.listen).call(server, port)
  return { dir, port, close: promisify(server.close).bind(server) }
}

// TODO: remove once this is used more directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await serve()
  console.log(`Serve: ${server.dir} at http://localhost:${server.port}/`)
  await promisify(setTimeout)(3000)
  await server.close()
  console.log('Serve: closed')
}
