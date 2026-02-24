<div align="center">

# 🗓️ DSU 多站自动签到

**一个在 [脚本猫](https://scriptcat.org/) 上运行的 Discuz! DSU 每日自动签到脚本**

[![Version](https://img.shields.io/badge/version-0.2.2-blue.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-yellow.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![ScriptCat](https://img.shields.io/badge/platform-脚本猫-orange.svg)](https://scriptcat.org/zh-CN/script-show-page/4495)

基于 [Ne-21](https://scriptcat.org/zh-CN/users/227) 的 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332) 重构

</div>

---

## ✨ 功能特性

- 🚀 **多站批量签到** — 一次运行，自动完成所有已配置站点的签到
- ⏰ **定时自动执行** — 支持 crontab 定时任务，每天自动签到无需手动操作
- 🔄 **智能重试机制** — 网络错误、超时等异常情况自动重试，最多 3 次
- 📢 **通知推送** — 签到完成后推送浏览器通知，汇总成功 / 失败结果
- 🎛️ **菜单操作** — 浏览器扩展菜单一键手动签到或重试失败站点
- 🧩 **易于扩展** — 简单配置即可添加更多 Discuz! + DSU 签到插件的网站

## 📋 支持的网站

| # | 网站名称 | 地址 |
|:-:|---------|------|
| 1 | 油猴中文网 | <https://bbs.tampermonkey.net.cn> |
| 2 | Anime字幕论坛 | <https://bbs.acgrip.com> |
| 3 | 天使动漫论坛 | <https://www.tsdm39.com> |

> 💡 理论上支持所有使用 **Discuz! + dsu_paulsign** 签到插件的论坛，只需简单配置即可添加。

## 🚀 快速开始

### 前置条件

- 浏览器已安装 **[脚本猫 (ScriptCat)](https://scriptcat.org/)** 扩展
- 已在目标网站完成登录（脚本依赖浏览器缓存的登录状态）

### 安装步骤

1. 前往 [脚本猫脚本页面](https://scriptcat.org/zh-CN/script-show-page/4495) 安装脚本
2. 安装时授权脚本访问相关网站的 Cookie
3. 安装完成后脚本将自动运行 ✅

## 📖 使用方法

### 自动签到

脚本安装后会自动执行，无需手动干预：

- **脚本加载时** 自动执行一次批量签到
- **定时任务** 通过 `@crontab * 1-23 once * *` 配置，每天 1:00 ~ 23:00 之间自动触发一次

### 手动操作

在浏览器脚本猫扩展菜单中提供以下快捷操作：

| 菜单项 | 说明 |
|-------|------|
| 🚀 **立即签到** | 强制重新执行全部站点签到（清除失败记录后重签） |
| ⚡ **重试失败站点** | 仅重试上次签到失败的站点 |

## ⚙️ 配置说明

### 添加新站点

编辑脚本顶部的 `SITES` 数组，按以下格式添加：

```javascript
{
    name: '网站名称',           // 站点显示名称
    signPageUrl: '签到页面URL', // 用于获取 formhash 的页面
    signApiUrl: '签到API URL',  // 签到请求接口
    referer: 'Referer头',      // 请求的 Referer 头
    domain: 'Cookie域',        // Cookie 域名（注意前导点号）
    enabled: true              // 是否启用（true/false）
}
```

> ⚠️ 添加新站点后，还需在脚本元数据中添加对应的 `@exportcookie` 和 `@connect` 声明。

### 重试配置

在 `RETRY_CONFIG` 中自定义重试策略：

```javascript
const RETRY_CONFIG = {
    maxRetries: 3,     // 最大重试次数
    retryDelay: 2000,  // 重试间隔（毫秒）
    timeout: 10000     // 单次请求超时时间（毫秒）
};
```

## 🔧 技术实现

### 签到流程

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌──────────┐
│ 加载签到页面 │ ──▶│ 提取 formhash 值  │ ──▶│ POST 签到请求 │ ──▶│ 解析结果  │
└─────────────┘    └──────────────────┘    └─────────────┘    └──────────┘
                          │ 失败                  │ 失败
                          ▼                       ▼
                   ┌──────────────┐        ┌──────────────┐
                   │ 自动重试(≤3) │        │ 自动重试(≤3) │
                   └──────────────┘        └──────────────┘
```

1. **获取 formhash** — 请求签到页面，通过正则匹配提取表单验证值
2. **提交签到** — 携带 formhash 和签到参数（心情、签到语）发起 POST 请求
3. **结果判定** — 解析返回内容，匹配成功 / 失败关键词，确定签到状态
4. **失败重试** — 网络错误、超时等异常自动重试，超过上限则记录失败

### 数据存储

使用脚本猫 `GM_setValue` / `GM_getValue` API 持久化存储：

| 存储键 | 用途 |
|-------|------|
| `site_config` | 站点配置信息 |
| `failed_sites` | 上次签到失败的站点列表 |

### 使用的 API

| API | 用途 |
|-----|------|
| `GM_xmlhttpRequest` | 跨域发起签到网络请求 |
| `GM_notification` | 推送浏览器签到结果通知 |
| `GM_registerMenuCommand` | 注册手动操作菜单 |
| `GM_setValue` / `GM_getValue` | 持久化存储数据 |
| `GM_log` | 记录运行日志 |

## ⚠️ 注意事项

1. **保持登录状态** — 脚本依赖浏览器缓存的 Cookie，使用前请确保已在各目标网站登录
2. **Cookie 权限** — 首次安装时需授权脚本访问相关网站的 Cookie
3. **Anime字幕论坛** — 该站风控较严，可能触发人机验证，建议先手动访问一次
4. **首次运行** — 打开浏览器后需运行一次脚本才能在菜单中看到手动触发选项

## 🐛 已知问题

- 部分网站首次使用时需先手动访问才能正常签到
- 网络不稳定环境下可能导致签到失败（会自动重试）
- 目标网站域名变更时需手动更新配置

## 🤝 参与贡献

本人能力有限，脚本使用过程���可能遇到各种 BUG。

**欢迎提交 PR** 来修复 BUG 或添加更多网站支持！ᓚᘏᗢ

1. Fork 本仓库
2. 创建你的功能分支 (`git checkout -b feature/new-site`)
3. 提交你的修改 (`git commit -m 'feat: 添加XXX网站支持'`)
4. 推送到分支 (`git push origin feature/new-site`)
5. 创建 Pull Request

## 📜 致谢

- [Ne-21](https://scriptcat.org/zh-CN/users/227) — 原始 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332) 作者
- [DeepSeek](https://chat.deepseek.com/) — AI 辅助代码编写
- [脚本猫 (ScriptCat)](https://scriptcat.org/) — 脚本运行平台

## ⚖️ 免责声明

本脚本仅供学习研究使用。使用本脚本请遵守相关网站的服务条款与规定。因使用本脚本造成的任何问题，开发者不承担任何责任。
