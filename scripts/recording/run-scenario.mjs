#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import net from 'node:net'

const require = createRequire(import.meta.url)
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const automator = require(resolve(appRoot, 'node_modules/miniprogram-automator/out/index.js'))

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (!item.startsWith('--')) {
      args._.push(item)
      continue
    }
    const [rawKey, inlineValue] = item.slice(2).split('=', 2)
    const key = rawKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    let value = true
    if (inlineValue !== undefined) value = inlineValue
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) value = argv[++i]
    if (key === 'var') {
      if (!Array.isArray(args.var)) args.var = []
      args.var.push(value)
    } else {
      args[key] = value
    }
  }
  return args
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

function portOpen(port) {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => { socket.destroy(); resolvePromise(true) })
    socket.once('error', () => resolvePromise(false))
    socket.setTimeout(1000, () => { socket.destroy(); resolvePromise(false) })
  })
}

async function ensureAutoPort({ projectPath, port }) {
  if (await portOpen(port)) return
  const cli = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
  const result = spawnSync(cli, ['auto', '--project', projectPath, '--auto-port', String(port), '--trust-project'], {
    cwd: appRoot,
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    throw new Error(`Failed to enable WeChat DevTools automation:\n${result.stderr || result.stdout}`)
  }
  for (let i = 0; i < 30; i += 1) {
    if (await portOpen(port)) return
    await sleep(500)
  }
  throw new Error(`Automation port ${port} did not open`)
}

function findDevToolsWindow(owner = '微信开发者工具') {
  const script = resolve(appRoot, 'scripts/recording/lib/find-window.swift')
  const result = spawnSync('swift', [script, owner], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Unable to list macOS windows')
  const windows = result.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
  const preferred = windows.find((window) => window.title?.includes('装得清')) || windows[0]
  if (!preferred) throw new Error(`No visible window found for owner: ${owner}`)
  return preferred
}

function replaceVars(value, vars) {
  if (typeof value !== 'string') return value
  return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, (_, key) => vars[key] ?? `\${${key}}`)
}

async function visibleElements(page) {
  const elements = await page.$$('*')
  const output = []
  for (const element of elements) {
    try {
      const text = String(await element.text()).trim()
      if (text) output.push({ element, text })
    } catch {}
  }
  return output
}

async function pageText(page) {
  const values = await visibleElements(page)
  return [...new Set(values.map((item) => item.text))].filter((text) => text.length <= 1000).slice(0, 200).join('\n')
}

async function findTextElement(page, value, exact = false) {
  const wanted = String(value)
  const items = await visibleElements(page)
  const matches = items
    .filter((item) => exact ? item.text === wanted : item.text.includes(wanted))
    .sort((a, b) => a.text.length - b.text.length)
  if (!matches.length) throw new Error(`Text not found: ${wanted}`)
  return matches[0].element
}

async function waitForText(page, value, timeoutMs = 8000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const text = await pageText(page)
    if (text.includes(String(value))) return text
    await sleep(250)
  }
  throw new Error(`Timed out waiting for text: ${value}`)
}

async function runStep(mp, step, vars, runDir) {
  let page = await mp.currentPage()
  const id = step.id || `STEP-${Date.now()}`
  const action = step.action
  const record = { id, action, caption: step.caption || '', startedAt: new Date().toISOString() }

  if (action === 'reLaunch' || action === 'navigateTo' || action === 'switchTab') {
    const url = replaceVars(step.url, vars)
    if (url.includes('${')) throw new Error(`Unresolved URL variable: ${url}`)
    if (action === 'reLaunch') page = await mp.reLaunch(url)
    if (action === 'navigateTo') page = await mp.navigateTo(url)
    if (action === 'switchTab') page = await mp.switchTab(url)
    await sleep(step.waitMs ?? 1200)
  } else if (action === 'navigateBack') {
    await mp.navigateBack(step.delta ?? 1)
    await sleep(step.waitMs ?? 800)
    page = await mp.currentPage()
  } else if (action === 'tapText') {
    const element = await findTextElement(page, replaceVars(step.text, vars), step.exact === true)
    await element.tap()
    await sleep(step.waitMs ?? 900)
    page = await mp.currentPage()
  } else if (action === 'tapSelector') {
    const elements = await page.$$(replaceVars(step.selector, vars))
    const element = elements[step.index ?? 0]
    if (!element) throw new Error(`Selector not found: ${step.selector} [${step.index ?? 0}]`)
    await element.tap()
    await sleep(step.waitMs ?? 900)
    page = await mp.currentPage()
  } else if (action === 'input') {
    const elements = await page.$$(replaceVars(step.selector, vars))
    const element = elements[step.index ?? 0]
    if (!element || typeof element.input !== 'function') throw new Error(`Input not found: ${step.selector} [${step.index ?? 0}]`)
    await element.input(replaceVars(step.value, vars))
    await sleep(step.waitMs ?? 500)
  } else if (action === 'scroll') {
    const selector = step.selector || 'scroll-view'
    const element = await page.$(selector)
    if (!element || typeof element.scrollTo !== 'function') throw new Error(`ScrollView not found: ${selector}`)
    await element.scrollTo(step.x ?? 0, step.y ?? 400)
    await sleep(step.waitMs ?? 800)
  } else if (action === 'waitForText') {
    await waitForText(page, replaceVars(step.text, vars), step.timeoutMs ?? 8000)
  } else if (action === 'assertText') {
    const text = await pageText(page)
    if (!text.includes(replaceVars(step.text, vars))) throw new Error(`Assertion failed: ${step.text}`)
  } else if (action === 'sleep') {
    await sleep(step.waitMs ?? 1000)
  } else if (action !== 'capture') {
    throw new Error(`Unsupported action: ${action}`)
  }

  page = page || await mp.currentPage()
  const framePath = resolve(runDir, 'frames', `${id}.png`)
  mkdirSync(dirname(framePath), { recursive: true })
  await mp.screenshot({ path: framePath })
  const textPath = resolve(runDir, 'page-text', `${id}.txt`)
  mkdirSync(dirname(textPath), { recursive: true })
  writeFileSync(textPath, await pageText(page))

  return {
    ...record,
    endedAt: new Date().toISOString(),
    path: page.path,
    query: page.query,
    frame: framePath,
    text: textPath,
    durationMs: step.frameDurationMs ?? step.waitMs ?? 1500
  }
}


function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const hours = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const minutes = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const secs = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const millis = String(ms % 1000).padStart(3, '0')
  return `${hours}:${minutes}:${secs},${millis}`
}

function createSubtitles(steps, outputPath) {
  const lines = []
  let cursor = 0
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
    const duration = Math.max(0.5, (step.durationMs || 1500) / 1000)
    lines.push(String(index + 1))
    lines.push(`${srtTime(cursor)} --> ${srtTime(cursor + duration)}`)
    lines.push(step.caption || step.id)
    lines.push('')
    cursor += duration
  }
  writeFileSync(outputPath, lines.join('\n'))
  return outputPath
}

function createFrameVideo(steps, outputPath) {
  const concatPath = resolve(dirname(outputPath), 'frames.concat.txt')
  const lines = []
  for (const step of steps) {
    const seconds = Math.max(0.5, (step.durationMs || 1500) / 1000)
    lines.push(`file '${step.frame.replace(/'/g, "'\\''")}'`)
    lines.push(`duration ${seconds.toFixed(3)}`)
  }
  if (steps.length) lines.push(`file '${steps.at(-1).frame.replace(/'/g, "'\\''")}'`)
  writeFileSync(concatPath, lines.join('\n') + '\n')
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', concatPath,
    '-vf', 'fps=30,scale=1080:-2:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-movflags', '+faststart', outputPath
  ], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg frame video failed')
  const subtitlesPath = resolve(dirname(outputPath), 'subtitles.srt')
  createSubtitles(steps, subtitlesPath)
  return { outputPath, concatPath, subtitlesPath }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scenarioPath = resolve(args._[0] || args.scenario || 'scripts/recording/scenarios/website-boss-overview.json')
  const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8'))
  const projectPath = resolve(appRoot, args.project || scenario.projectPath || 'dist/dev/mp-weixin')
  const port = Number(args.port || scenario.autoPort || 9420)
  const outputRoot = resolve(appRoot, args.output || 'recordings')
  const runDir = resolve(outputRoot, scenario.id, stamp())
  mkdirSync(resolve(runDir, 'frames'), { recursive: true })
  mkdirSync(resolve(runDir, 'page-text'), { recursive: true })
  mkdirSync(resolve(runDir, 'video'), { recursive: true })

  const vars = { ...(scenario.vars || {}) }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('MP_') && value) vars[key.slice(3).toLowerCase()] = value
  }
  for (const item of Array.isArray(args.var) ? args.var : []) {
    const [key, value] = String(item).split('=', 2)
    if (key && value !== undefined) vars[key] = value
  }

  await ensureAutoPort({ projectPath, port })
  const stepCount = (scenario.steps || []).length
  const estimatedSeconds = Math.max(
    12,
    Math.ceil((scenario.steps || []).reduce((sum, step) => sum + (step.waitMs || 1000), 0) / 1000) + stepCount * 3 + 5
  )
  const mode = args.dryRun || args.noRecord
    ? 'none'
    : args.framesOnly
      ? 'frames'
      : (args.recordMode || scenario.recordMode || 'both')
  let window = null
  if (mode === 'window' || mode === 'both') {
    spawnSync('open', ['-a', '/Applications/wechatwebdevtools.app'])
    await sleep(500)
    window = args.window
      ? { id: Number(args.window), owner: scenario.windowOwner || '微信开发者工具', title: '' }
      : findDevToolsWindow(scenario.windowOwner || '微信开发者工具')
  }
  const windowVideo = resolve(runDir, 'video', `${scenario.id}-window.mov`)
  let recorder = null
  let recorderDone = null

  if (mode === 'window' || mode === 'both') {
    recorder = spawn('screencapture', ['-l', String(window.id), '-v', '-k', '-x', '-V', String(estimatedSeconds), windowVideo], {
      stdio: 'ignore'
    })
    recorderDone = new Promise((resolvePromise) => recorder.once('exit', resolvePromise))
  }

  const mp = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` })
  const results = []
  try {
    const reuseSession = args.reuseSession === true || scenario.loginMode === 'current'
    const loginToken = scenario.loginTokenEnv ? process.env[scenario.loginTokenEnv] : ''
    if (scenario.loginTokenEnv && !loginToken && !reuseSession) {
      throw new Error(`Missing login token env: ${scenario.loginTokenEnv}; pass --reuse-session to use the current DevTools session`)
    }
    if (loginToken) {
      await mp.callWxMethod('clearStorageSync')
      await mp.reLaunch(`/pages/auth/login?devToken=${encodeURIComponent(loginToken)}`)
      await sleep(3500)
    }

    for (const rawStep of scenario.steps || []) {
      const requiredMissing = (rawStep.requiresVars || []).some((key) => !vars[key])
      if (requiredMissing) {
        results.push({ id: rawStep.id, action: rawStep.action, status: 'SKIPPED', reason: 'missing variables' })
        continue
      }
      try {
        results.push({ status: 'PASS', ...(await runStep(mp, rawStep, vars, runDir)) })
      } catch (error) {
        results.push({ id: rawStep.id, action: rawStep.action, status: rawStep.optional ? 'SKIPPED' : 'FAIL', error: String(error?.message || error) })
        if (!rawStep.optional && scenario.continueOnError !== true) throw error
      }
    }
  } finally {
    try { await mp.disconnect() } catch {}
    if (recorderDone) await recorderDone
  }

  const successfulSteps = results.filter((item) => item.status === 'PASS')
  let frameVideo = null
  if (successfulSteps.length && mode !== 'none') {
    frameVideo = createFrameVideo(successfulSteps, resolve(runDir, 'video', `${scenario.id}-clean.mp4`))
  }

  const metadata = {
    scenario: scenario.id,
    title: scenario.title,
    recordedAt: new Date().toISOString(),
    projectPath,
    window,
    estimatedSeconds,
    mode,
    frameVideo: frameVideo?.outputPath || null,
    subtitles: frameVideo?.subtitlesPath || null,
    windowVideo: mode === 'window' || mode === 'both' ? windowVideo : null,
    steps: results
  }
  writeFileSync(resolve(runDir, 'run.json'), JSON.stringify(metadata, null, 2))
  console.log(JSON.stringify({ runDir, frameVideo: metadata.frameVideo, windowVideo: metadata.windowVideo, steps: results.map(({ id, status, path, error }) => ({ id, status, path, error })) }, null, 2))
}

main().catch((error) => {
  console.error(error.stack || error)
  process.exit(1)
})
