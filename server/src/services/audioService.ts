import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'

const serverRoot = path.resolve(__dirname, '../..')
const uploadsDir = path.join(serverRoot, 'uploads')

function resolveFfmpegCommand(): string {
  const fromEnv = process.env.FFMPEG_PATH?.trim()

  if (fromEnv) {
    return fromEnv
  }

  if (ffmpegStatic) {
    return ffmpegStatic
  }

  return 'ffmpeg'
}

function buildFfmpegInstallMessage(originalMessage: string): string {
  return [
    '未检测到可用的 ffmpeg。',
    '请先在 server 目录重新执行 `npm install`，让 `ffmpeg-static` 下载内置二进制；',
    '如果仍然失败，再安装系统 ffmpeg，或通过 `FFMPEG_PATH` 指定绝对路径。',
    `原始信息：${originalMessage}`
  ].join(' ')
}

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
  const ffmpegCommand = resolveFfmpegCommand()

  try {
    await runCommand(ffmpegCommand, ['-version'])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    throw new Error(buildFfmpegInstallMessage(message))
  }
}

export async function convertAudioToWav(inputPath: string, tempId: string): Promise<string> {
  await ensureFfmpegAvailable()
  const ffmpegCommand = resolveFfmpegCommand()

  const outputPath = path.join(os.tmpdir(), `cansing-${tempId}.wav`)

  await runCommand(ffmpegCommand, [
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
