import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'

const startedAt = Date.now()

function elapsed() {
  return `${Date.now() - startedAt}ms`
}

function log(message) {
  console.log(`[capture +${elapsed()}] ${message}`)
}

function fail(message, exitCode = 1) {
  const error = new Error(message)
  error.exitCode = exitCode
  return error
}

const transient = message => fail(message, 75)

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
const project = resolve(process.env.PROJECT_DIR || process.cwd())

if (!url) throw fail('Set CAPTURE_URL.')
if (!output) throw fail('Set CAPTURE_DIR.')

const captureDir = resolve(output)
if (captureDir === project || captureDir.startsWith(project + sep)) {
  throw fail('CAPTURE_DIR must be outside the project source and build directories.')
}
mkdirSync(captureDir, { recursive: true })

const runtime = process.env.OMGITHUB_PLAYWRIGHT_ROOT || join(homedir(), '.local', 'share', 'omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')

const configPath = join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json')
if (!existsSync(configPath)) throw fail(`Missing Playwright launch config: ${configPath}`)
const config = JSON.parse(readFileSync(configPath, 'utf8'))

if (process.platform === 'linux' && !process.env.DISPLAY) {
  process.env.DISPLAY = ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
]

let browser
let pageErrors = []

try {
  log(`Launching Chromium for ${url}`)
  browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => {
    throw transient(`Browser launch failed: ${error.message}`)
  })
  log('Browser ready')

  for (const viewport of viewports) {
    pageErrors = []
    log(`Opening ${viewport.name} viewport ${viewport.width}x${viewport.height}`)
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      geolocation: { latitude: 37.7749, longitude: -122.4194, accuracy: 18 },
      permissions: ['geolocation'],
      colorScheme: 'dark',
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    }).catch(error => {
      throw transient(`Could not create browser context: ${error.message}`)
    })

    const page = await context.newPage().catch(error => {
      throw transient(`Could not open a browser page: ${error.message}`)
    })
    page.setDefaultTimeout(30000)
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') console.error(`[browser] ${message.text()}`)
    })

    let response
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    } catch (error) {
      await context.close().catch(() => {})
      throw transient(`Navigation failed: ${error.message}`)
    }

    if (!response) {
      await context.close().catch(() => {})
      throw transient(`No HTTP response from ${url}`)
    }
    if (!response.ok()) {
      const status = response.status()
      const temporary = [408, 425, 429, 500, 502, 503, 504].includes(status)
      await context.close().catch(() => {})
      throw fail(`Preview returned HTTP ${status}`, temporary ? 75 : 1)
    }

    try {
      await page.waitForSelector('html[data-app-ready="true"]', { state: 'attached', timeout: 30000 })
      await page.waitForSelector('body', { state: 'visible', timeout: 30000 })
      await page.evaluate(() => document.fonts.ready)
      await page.locator('#share-location').waitFor({ state: 'visible', timeout: 15000 })
      await page.locator('#share-location').click({ timeout: 15000 })
      await page.locator('#unlock-code[data-unlocked="true"]').waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(900)
    } catch (error) {
      await context.close().catch(() => {})
      throw fail(`Page did not render the unlock state: ${error.message}`, 1)
    }

    const path = join(captureDir, `final-${viewport.name}.png`)
    try {
      await page.screenshot({ path, timeout: 30000 })
    } catch (error) {
      await context.close().catch(() => {})
      throw transient(`Screenshot failed: ${error.message}`)
    }

    const bytes = readFileSync(path)
    if (bytes.length < 10_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      await context.close().catch(() => {})
      throw fail(`Screenshot is not a valid rendered PNG: ${path}`, 1)
    }
    log(`Saved ${path} (${bytes.length} bytes)`)

    if (pageErrors.length) {
      await context.close().catch(() => {})
      throw fail(`Page emitted runtime errors: ${pageErrors.join(' | ')}`, 1)
    }

    await context.close().catch(error => {
      throw transient(`Could not close browser context: ${error.message}`)
    })
  }
} catch (error) {
  console.error(`[capture +${elapsed()}] ${error.stack || error}`)
  process.exitCode = error.exitCode || 1
} finally {
  await browser?.close().catch(error => {
    console.error(`[capture +${elapsed()}] Browser close failed: ${error.message}`)
    process.exitCode ||= 75
  })
  log(`Finished with exit code ${process.exitCode || 0}`)
}

if (process.exitCode) process.exit(process.exitCode)
