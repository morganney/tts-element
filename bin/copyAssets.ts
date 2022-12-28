import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { readdir, stat, cp } from 'node:fs/promises'

const filename = fileURLToPath(import.meta.url)
const directory = dirname(filename)
const dest = resolve(directory, '../dist')
const copyAssets = async (from = resolve(directory), to = dest, preserve = true) => {
  const files = await readdir(from)

  for (const file of files) {
    const path = resolve(from, file)
    const stats = await stat(path)

    if (stats.isFile()) {
      const extension = extname(path)

      if (extension === '.css' || extension === '.html') {
        await cp(path, resolve(to, file))
      }
    } else {
      await copyAssets(path, preserve ? resolve(to, file) : to)
    }
  }
}
const copyAssetsToWebRoot = async (root: string) => {
  await copyAssets(resolve(directory), root, false)
}

/**
 * If file is called from the CLI as a node process,
 * then copy the assets to the dist folder.
 */
if (resolve(process.argv[1]) === resolve(filename)) {
  await copyAssets(resolve(directory, '../src'), dest)
}

export { copyAssetsToWebRoot, copyAssets }
