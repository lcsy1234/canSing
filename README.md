# canSing

一个基于 Taro 小程序 + Node.js 的日语跟唱练习项目。

## 已实现

- 小程序前端：上传音频、即时录音、处理中、历史记录、跟唱详情
- 本地后端：音频上传、Whisper 转写、平假名/罗马音生成、中文谐音生成、历史记录存储
- 页面展示：原文 / 假名 / 罗马音 / 中文谐音
- 音频播放：按时间轴逐句高亮，支持跳转上一句/下一句

## 目录结构

- `taro-demo`：Taro 小程序前端
- `server`：Express 后端，调用 `whisper-node`

## 启动前准备

### 1. 准备 ffmpeg

后端会优先使用 `server` 依赖里的 `ffmpeg-static`，所以大多数情况下先执行下面这步就够了：

```bash
cd server
npm install
```

如果你的环境里 `ffmpeg-static` 下载失败，再安装系统 `ffmpeg`，或者通过 `FFMPEG_PATH` 指向本地 ffmpeg 可执行文件。

macOS 可参考：

```bash
brew install ffmpeg
```

### 2. 下载 Whisper 模型

在 `server` 目录执行：

```bash
npm run download:model
```

默认使用 `base` 模型。也可以通过 `WHISPER_MODEL_NAME` 或 `WHISPER_MODEL_PATH` 自定义。

如果你的网络暂时连不上 `huggingface.co`，推荐直接把模型手动放到下面这个目录：

```text
server/models/ggml-base.bin
```

项目现在会自动优先读取 `server/.env`，并优先从 `server/models` 查找模型，不需要再把模型塞进 `node_modules`。

## 启动后端

```bash
cd server
npm install
npm run dev
```

默认地址：

```text
http://127.0.0.1:3001
```

## 启动小程序前端

```bash
cd taro-demo
pnpm install
TARO_APP_API_BASE_URL=http://127.0.0.1:3001 pnpm dev:weapp
```

然后把 `taro-demo/dist` 导入微信开发者工具。

## API

### `POST /api/transcriptions`

表单字段：

- `audio`: 音频文件
- `sourceType`: `upload` 或 `record`
- `title`: 可选，自定义标题

### `GET /api/history`

返回全部处理历史。

### `GET /api/history/:id`

返回单条可跟唱记录详情。

## 当前验证情况

- `server`: `npm run build` 通过
- `taro-demo`: `pnpm exec tsc --noEmit` 通过
- `taro-demo`: `pnpm build:weapp` 通过

## 说明

- 中文谐音为启发式映射，适合跟唱辅助，不是严格语言学转写。
- Whisper 对纯音乐伴奏或混响过重的人声识别会下降，建议优先上传副歌清晰片段。
