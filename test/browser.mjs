import puppeteer from 'puppeteer'
import { serve } from './server.mjs'

// Start Puppeteer
const server = await serve()
console.log(server)
const browser = await puppeteer.launch()
const page = await browser.newPage()
console.log('goto', `http://localhost:${server.port}`)
await page.goto(`http://localhost:${server.port}`)

const title = await page.title()

console.log('title', title)

await browser.close()
await server.close()
