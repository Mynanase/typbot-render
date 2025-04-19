import { Context, Schema, h } from 'koishi'
import { resolve } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'

// 导出插件名称
export const name = 'typbot-render'

// 不要使用默认导出，Koishi 插件系统依赖于具名导出

export interface Config {
  /** 临时文件保存路径 */
  tempPath: string
  /** 是否开启调试模式 */
  debug: boolean
  /** 渲染超时时间 (ms) */
  timeout: number
  /** 渲染图片的文字颜色 */
  color: string
  /** 渲染图片的字体大小 */
  fontSize: number
  /** 渲染图片的宽度 */
  width: number | 'auto'
  /** 渲染图片的高度 */
  height: number | 'auto'
  /** 渲染图片的 DPI */
  dpi: number
}

export const Config: Schema<Config> = Schema.object({
  tempPath: Schema.string().default('temp/typst').description('临时文件保存路径'),
  debug: Schema.boolean().default(false).description('是否开启调试模式'),
  timeout: Schema.number().default(10000).description('渲染超时时间 (ms)'),
  color: Schema.string().default('#000000').description('渲染图片的文字颜色'),
  fontSize: Schema.number().default(16).description('渲染图片的字体大小'),
  width: Schema.union([
    Schema.const('auto').description('自动宽度'),
    Schema.number().description('指定宽度（pt）')
  ]).default('auto').description('渲染图片的宽度'),
  height: Schema.union([
    Schema.const('auto').description('自动高度'),
    Schema.number().description('指定高度（pt）')
  ]).default('auto').description('渲染图片的高度'),
  dpi: Schema.number().default(300).description('渲染图片的 DPI')
})

// 颜色处理函数，将各种颜色格式转换为 Typst 可以识别的格式
function processColor(color: string): string {
  // 如果是十六进制颜色代码（如 #ffffff）
  if (color.startsWith('#')) {
    // 移除 # 前缀
    const hex = color.substring(1);
    
    // 处理三位十六进制颜色（如 #fff）
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16) / 255;
      const g = parseInt(hex[1] + hex[1], 16) / 255;
      const b = parseInt(hex[2] + hex[2], 16) / 255;
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // 处理六位十六进制颜色（如 #ffffff）
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // 处理八位十六进制颜色（包含透明度，如 #ffffffff）
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      const a = parseInt(hex.substring(6, 8), 16) / 255;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }
  
  // 如果是命名颜色（如 red, blue 等）
  // Typst 支持大多数标准颜色名称
  const namedColors = [
    'black', 'gray', 'white', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow',
    'olive', 'purple', 'teal', 'navy', 'maroon', 'lime', 'aqua', 'silver', 'fuchsia'
  ];
  
  if (namedColors.includes(color.toLowerCase())) {
    return color.toLowerCase();
  }
  
  // 默认返回原始颜色，如果已经是 Typst 支持的格式（如 rgb(0, 0, 0)）
  return color;
}

// Typst 渲染模板
const typstTemplates = {
  markup: (content: string, config: Config) => `
#set page(
  width: ${config.width === 'auto' ? 'auto' : `${config.width}pt`},
  height: ${config.height === 'auto' ? 'auto' : `${config.height}pt`},
  margin: 0.5em,
)
#set text(
  font: ("Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "SimHei", "SimSun", "Liberation Sans", "Helvetica", "Arial", sans-serif),
  size: ${config.fontSize}pt,
  fill: ${processColor(config.color)},
)

${content}
  `,
  script: (content: string, config: Config) => `
#set page(
  width: ${config.width === 'auto' ? 'auto' : `${config.width}pt`},
  height: ${config.height === 'auto' ? 'auto' : `${config.height}pt`},
  margin: 0.5em
)
#set text(
  font: ("Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "SimHei", "SimSun", "Liberation Sans", "Helvetica", "Arial", sans-serif),
  size: ${config.fontSize}pt,
  fill: ${processColor(config.color)},
)
#let content = {
  ${content}
}
#content
  `,
  math: (content: string, config: Config) => `
#set page(
  width: ${config.width === 'auto' ? 'auto' : `${config.width}pt`},
  height: ${config.height === 'auto' ? 'auto' : `${config.height}pt`},
  margin: 0.5em
)
#set text(
  font: ("Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "WenQuanYi Micro Hei", "SimHei", "SimSun", "Liberation Sans", "Helvetica", "Arial", sans-serif),
  size: ${config.fontSize}pt,
  fill: ${processColor(config.color)},
)
#set math.equation(numbering: none)
$ ${content} $
  `
}

export const inject = ['puppeteer']

export async function apply(ctx: Context, config: Config) {
  // 确保临时目录存在
  const tempDir = resolve((ctx as any).baseDir, config.tempPath)
  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true })
  }

  // 辅助函数：渲染 Typst 代码
  async function renderTypst(content: string, mode: 'markup' | 'script' | 'math', customConfig?: Partial<Config>) {
    // 合并默认配置和自定义配置
    const mergedConfig = { ...config, ...customConfig }
    try {
      // 创建 Typst 代码
      const typstCode = typstTemplates[mode](content, mergedConfig)
      
      // 为调试模式保存 Typst 源码的副本
      if (mergedConfig.debug) {
        const timestamp = Date.now()
        const debugPath = resolve(tempDir, `debug-${timestamp}.typ`)
        await writeFile(debugPath, typstCode, 'utf-8')
        ctx.logger('typbot-render').info(`Debug file saved: ${debugPath}`)
      }

      // 使用本地 Typst CLI 渲染
      // 使用 child_process 的 spawn 来执行 typst 命令，并直接捕获标准输出
      const { spawn } = require('child_process')
      
      // 创建一个 Promise 来处理 spawn 的异步过程
      const typstProcess = new Promise<Buffer>((resolve, reject) => {
        // 执行 typst 命令，将输出直接导向到标准输出
        const process = spawn('typst', [
          'compile',
          '--format', 'png',
          '-',  // 使用 - 表示从标准输入读取
          '-'   // 使用 - 表示输出到标准输出
        ], { timeout: mergedConfig.timeout })
        
        // 将 Typst 代码写入标准输入
        process.stdin.write(typstCode)
        process.stdin.end()
        
        // 收集数据块
        const chunks: Buffer[] = []
        process.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk)
        })
        
        // 错误处理
        let errorOutput = ''
        process.stderr.on('data', (data) => {
          errorOutput += data.toString()
        })
        
        // 完成处理
        process.on('close', (code) => {
          if (code === 0) {
            // 成功，将所有数据块合并为一个 Buffer
            const imageBuffer = Buffer.concat(chunks)
            resolve(imageBuffer)
          } else {
            // 失败，返回错误信息
            reject(new Error(`Typst compilation failed with code ${code}: ${errorOutput}`))
          }
        })
        
        // 异常处理
        process.on('error', (err) => {
          reject(new Error(`Failed to start Typst process: ${err.message}`))
        })
      })
      
      // 等待 Typst 运行完成并获取图片数据
      const imageBuffer = await typstProcess
      
      // 将图片转换为 base64 格式
      const base64Image = imageBuffer.toString('base64')
      
      // 不需要清理临时文件，因为我们直接使用标准输入/输出
      
      // 返回 base64 编码的图片
      return h.image(`data:image/png;base64,${base64Image}`)
    } catch (error) {
      ctx.logger('typbot-render').error(error)
      return `Typst 渲染失败: ${error.message}`
    }
  }

  // 注册命令组
  ctx.command('typst', '所有 Typst 相关命令')
    .usage('用于渲染 Typst 代码的命令组')

  // 注册子命令
  ctx.command('typst.markup <content:text>', '渲染 Typst 标记模式代码')
    .alias('typ')  // 设置别名
    .option('fg', '-f <color:string> 设置文字颜色', { fallback: config.color })
    .option('size', '-s <size:number> 设置字体大小', { fallback: config.fontSize })
    .option('width', '-w <width:string> 设置宽度（auto 或数字）', { fallback: config.width })
    .option('height', '--height <height:string> 设置高度（auto 或数字）', { fallback: config.height })
    .example('typ #hello("world")')
    .action(async (argv, content) => {
      if (!content) return '请提供 Typst 代码'
      
      // 使用命令选项覆盖默认配置
      // 处理宽度和高度值的类型转换
      const width = argv.options.width === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.width)) ? Number(argv.options.width) : config.width;
      const height = argv.options.height === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.height)) ? Number(argv.options.height) : config.height;
      
      const renderConfig = {
        ...config,
        color: argv.options.fg,
        fontSize: argv.options.size,
        width,
        height
      }
      
      return await renderTypst(content, 'markup', renderConfig)
    })

  ctx.command('typst.script <content:text>', '渲染 Typst 脚本模式代码')
    .alias('typc')  // 设置别名
    .option('fg', '-f <color:string> 设置文字颜色', { fallback: config.color })
    .option('size', '-s <size:number> 设置字体大小', { fallback: config.fontSize })
    .option('width', '-w <width:string> 设置宽度（auto 或数字）', { fallback: config.width })
    .option('height', '--height <height:string> 设置高度（auto 或数字）', { fallback: config.height })
    .example('typc "Hello, world!"')
    .action(async (argv, content) => {
      if (!content) return '请提供 Typst 代码'
      
      // 使用命令选项覆盖默认配置
      // 处理宽度和高度值的类型转换
      const width = argv.options.width === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.width)) ? Number(argv.options.width) : config.width;
      const height = argv.options.height === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.height)) ? Number(argv.options.height) : config.height;
      
      const renderConfig = {
        ...config,
        color: argv.options.fg,
        fontSize: argv.options.size,
        width,
        height
      }
      
      return await renderTypst(content, 'script', renderConfig)
    })

  ctx.command('typst.math <content:text>', '渲染 Typst 数学模式代码')
    .alias('teq')  // 设置别名
    .option('fg', '-f <color:string> 设置文字颜色', { fallback: config.color })
    .option('size', '-s <size:number> 设置字体大小', { fallback: config.fontSize })
    .option('width', '-w <width:string> 设置宽度（auto 或数字）', { fallback: config.width })
    .option('height', '--height <height:string> 设置高度（auto 或数字）', { fallback: config.height })
    .example('teq "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"')
    .action(async (argv, content) => {
      if (!content) return '请提供 Typst 代码'
      
      // 使用命令选项覆盖默认配置
      // 处理宽度和高度值的类型转换
      const width = argv.options.width === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.width)) ? Number(argv.options.width) : config.width;
      const height = argv.options.height === 'auto' ? 'auto' : 
        !isNaN(Number(argv.options.height)) ? Number(argv.options.height) : config.height;
      
      const renderConfig = {
        ...config,
        color: argv.options.fg,
        fontSize: argv.options.size,
        width,
        height
      }
      
      return await renderTypst(content, 'math', renderConfig)
    })
}
