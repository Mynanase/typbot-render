# koishi-plugin-typbot-render

[![npm](https://img.shields.io/npm/v/koishi-plugin-typbot-render?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-typbot-render)

Koishi 插件，用于渲染 Typst 标记、脚本和数学公式。使用本地 Typst CLI 进行高效渲染，无需依赖网络服务。

## 功能特点

- 支持三种渲染模式：标记模式、脚本模式和数学模式
- 使用本地 Typst CLI 进行高质量渲染
- 支持自定义文字颜色、字体大小、宽度和高度
- 直接输出 base64 编码的图片，无需保存临时文件
- 提供简洁的命令别名：`/typ`、`/typc` 和 `/teq`

## 安装前提

使用本插件前，请确保您的系统已安装 Typst CLI。

### 在 macOS 上安装 Typst

```bash
brew install typst
```

### 在 Windows 上安装 Typst

可以从 [Typst 官方网站](https://typst.app/) 或 [GitHub 发布页面](https://github.com/typst/typst/releases) 下载安装程序。

## 使用方法

### 标记模式

```
/typ Hello World!
```

### 脚本模式

```
/typc "Hello, world!"
```

### 数学模式

```
/teq x^2 + y^2 = z^2
```

## 命令选项

所有命令都支持以下选项：

- `-f, --fg <color>`: 设置文字颜色
- `-s, --size <size>`: 设置字体大小
- `-w, --width <width>`: 设置宽度（auto 或数字）
- `--height <height>`: 设置高度（auto 或数字）

例如：

```
/typ -f "blue" -s 20 -w 400 Hello World!
```

## 配置项

- `tempPath`: 临时文件保存路径
- `debug`: 是否开启调试模式（开启后会保存 Typst 源码）
- `timeout`: 渲染超时时间 (ms)
- `color`: 默认文字颜色（支持十六进制格式如 `#FF0000` 或命名颜色如 `red`）
- `fontSize`: 默认字体大小（单位：pt）
- `width`: 默认宽度（`auto` 或具体数值，单位：pt）
- `height`: 默认高度（`auto` 或具体数值，单位：pt）
- `dpi`: 渲染图片的 DPI（影响图片清晰度）

## 技术实现

本插件通过直接调用本地 Typst CLI 进行渲染，使用标准输入/输出流传递数据，避免了创建临时文件的开销。渲染结果以 base64 编码的 PNG 图片形式返回，可直接在聊天中显示。

## 依赖说明

- 本插件需要系统中已安装 Typst CLI
- 不再依赖 puppeteer，渲染效率更高

## 贡献指南

欢迎提交 Issues 和 Pull Requests 来改进此插件。请确保您的代码遵循项目的编码规范。

## 许可证

MIT
