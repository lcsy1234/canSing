import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'

const uploadsDir = path.resolve(process.cwd(), 'uploads')

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args)
    let stderr = ''

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code ?? 'unknown'}`))
    })
  })
}

export async function ensureUploadsReady(): Promise<void> {
  await fs.mkdir(uploadsDir, { recursive: true })
}

export function getUploadsDir(): string {
  return uploadsDir
}

export async function ensureFfmpegAvailable(): Promise<void> {
  try {
    await runCommand('ffmpeg', ['-version'])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(`未检测到 ffmpeg，请先安装 ffmpeg。原始信息：${message}`)
  }
}

export async function convertAudioToWav(inputPath: string, tempId: string): Promise<string> {
  await ensureFfmpegAvailable()

  const outputPath = path.join(os.tmpdir(), `cansing-${tempId}.wav`)

  await runCommand('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    outputPath
  ])

  return outputPath
}

export async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore cleanup failures for temp files.
  }
}
