#!/usr/bin/env node

import { isAbsolute, resolve } from 'node:path'
import { copyAssetsToWebRoot } from './copyAssets.js'

const args = process.argv.slice(2)
const defaultRoot = `${process.cwd()}/dist`
const logError = (msg: string): void => {
  console.error('\x1b[33m%s\x1b[0m', `[tts-copy-assets]: ${msg}`)
}
let option = args[0]
let value = args[1]

if (args.length === 1) {
  [option, value] = args[0].split('=')
}

if (!option) {
  copyAssetsToWebRoot(defaultRoot)
} else if (option === '--webroot' || option === '-w') {
  if (!value.trim()) {
    logError(`No value provided for option ${option}.`)
  } else if (isAbsolute(value)) {
    copyAssetsToWebRoot(value)
  } else {
    copyAssetsToWebRoot(resolve(process.cwd(), value))
  }
} else {
  logError(`Unrecognized option '${option}'.`)
}
