/** Carry the reviewed account patch with a kernel bump; pnpm still checks it. */
import { constants } from 'node:fs'
import { copyFile, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

const ACCOUNT = '@deepseek-ai/dsh-client-ui-settings-account'
const patchPath = version => `patches/@deepseek-ai__dsh-client-ui-settings-account@${version}.patch`

export async function syncKernelAccountPatch(root, previous, next) {
  if (previous === next) return false
  const directory = join(root, 'manifest', 'harness')
  const file = join(directory, 'pnpm-workspace.yaml')
  const source = await readFile(file, 'utf8')
  const document = parseDocument(source)
  if (document.errors.length) throw new Error('kernel patch workspace YAML is invalid')
  const patches = document.get('patchedDependencies', true)
  const oldKey = `${ACCOUNT}@${previous}`
  const newKey = `${ACCOUNT}@${next}`
  const entries = patches?.items?.filter(item => item.key?.value?.startsWith(`${ACCOUNT}@`)) ?? []
  if (entries.length === 0) return false
  if (entries.length === 1 && entries[0].key.value === newKey) return false
  if (entries.length !== 1 || entries[0].key.value !== oldKey || entries[0].value?.value !== patchPath(previous)) {
    throw new Error('review the account patch mapping before bumping the kernel')
  }
  // Never overwrite an existing candidate patch or change the reviewed diff.
  await copyFile(join(directory, patchPath(previous)), join(directory, patchPath(next)), constants.COPYFILE_EXCL)
  entries[0].key.value = newKey
  entries[0].value.value = patchPath(next)
  await writeFile(file, document.toString({ lineWidth: 0 }))
  await unlink(join(directory, patchPath(previous)))
  return true
}
