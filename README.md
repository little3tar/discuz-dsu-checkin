<div align="center">

# 🗓️ DSU 多站自动签到

**Discuz! DSU 每日自动签到脚本 - 支持脚本猫定时任务**

[![Version](https://img.shields.io/badge/version-0.2.5-blue.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![JavaScript](https://img.shields.io/badge/language-JavaScript-yellow.svg)](https://github.com/little3tar/discuz-dsu-checkin)
[![ScriptCat](https://img.shields.io/badge/platform-脚本猫-orange.svg)](https://scriptcat.org/zh-CN/script-show-page/4495)

基于 [Ne-21](https://scriptcat.org/zh-CN/users/227) 的 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332) 重构

</div>

---

## ✨ 功能特性

- 🚀 **多站批量签到** — 一次运行，自动完成所有已配置站点的签到
- ⏰ **定时自动执行** — 支持 crontab 定时任务，每天自动签到无需手动操作
- 🛡️ **防重复签到** — 智能检测当天是否已签到，避免重复执行
- 🔄 **智能重试机制** — 网络错误、超时等异常情况自动重试，最多 3 次
- 📢 **通知推送** — 签到完成后推送浏览器通知，汇总成功/失败结果
- 🎛️ **菜单操作** — 浏览器扩展菜单一键手动签到或重试失败站点
- 🧩 **易于扩展** — 简单配置即可添加更多 Discuz! + DSU 签到插件的网站

## 📋 支持的网站

|  #  | 网站名称      | 地址                              | 状态     |
| :-: | ------------- | --------------------------------- | -------- |
|  1  | 油猴中文网    | <https://bbs.tampermonkey.net.cn> | 已启用   |
|  2  | Anime字幕论坛 | <https://bbs.acgrip.com>          | 已启用   |
|  3  | 天使动漫论坛  | <https://www.tsdm39.com>          | 暂时停用 |

> ℹ️ 天使动漫论坛疑似暂时关闭，脚本中已临时注释该站点配置与相关权限声明，待网站恢复后可取消注释重新启用。

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

- **脚本加载时** 检查当天是否已签到，未签到则自动执行
- **定时任务** 通过 `@crontab * 1-23 once * *` 配置，每天 1:00 ~ 23:00 之间自动触发一次
- **防重复机制** 同一天内多次加载脚本不会重复签到

### 手动操作

在浏览器脚本猫扩展菜单中提供以下快捷操作：

| 菜单项              | 说明                                           |
| ------------------- | ---------------------------------------------- |
| 🚀 **立即签到**     | 强制重新执行全部站点签到（清除失败记录后重签） |
| ⚡ **重试失败站点** | 仅重试上次签到失败的站点                       |

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
  maxRetries: 3, // 最大重试次数
  retryDelay: 2000, // 重试间隔（毫秒）
  timeout: 10000, // 单次请求超时时间（毫秒）
};
```

## 🔧 技术实现

### 签到流程

**步骤 1：防重复检查**  
检查当天是否已签到 → 已签到则跳过，未签到则继续

**步骤 2：获取 formhash**  
请求签到页面 → 通过多种正则模式提取表单验证值 → 失败则重试（最多 3 次）

**步骤 3：提交签到**  
携带 formhash 和签到参数（心情、签到语）发起 POST 请求 → 失败则重试（最多 3 次）

**步骤 4：结果判定**  
解析返回内容 → 匹配成功/失败关键词 → 确定签到状态 → 记录结果

### 数据存储

使用脚本猫 `GM_setValue` / `GM_getValue` API 持久化存储：

| 存储键           | 用途                   |
| ---------------- | ---------------------- |
| `site_config`    | 站点配置信息           |
| `failed_sites`   | 上次签到失败的站点列表 |
| `last_sign_date` | 最后签到日期（防重复） |

### 使用的 API

| API                           | 用途                   |
| ----------------------------- | ---------------------- |
| `GM_xmlhttpRequest`           | 跨域发起签到网络请求   |
| `GM_notification`             | 推送浏览器签到结果通知 |
| `GM_registerMenuCommand`      | 注册手动操作菜单       |
| `GM_setValue` / `GM_getValue` | 持久化存储数据         |
| `GM_log`                      | 记录运行日志           |

## ⚠️ 注意事项

1. **保持登录状态** — 脚本依赖浏览器缓存的 Cookie，使用前请确保已在各目标网站登录
2. **Cookie 权限** — 首次安装时需授权脚本访问相关网站的 Cookie
3. **Anime字幕论坛** — 该站风控较严，可能触发人机验证，建议先手动访问一次
4. **天使动漫论坛** — 该站点当前暂时停用，恢复访问后可在脚本中取消注释重新启用
5. **防重复机制** — 同一天内多次加载脚本不会重复签到，手动签到不受此限制

## 🐛 已知问题

- 部分网站首次使用时需先手动访问才能正常签到
- 网络不稳定环境下可能导致签到失败（会自动重试最多 3 次）
- 目标网站域名变更时需手动更新配置
- 网站 HTML 结构变化可能导致 formhash 提取失败（已支持多种匹配模式）

## 📝 更新日志

### v0.2.5 (2026-04-26)

- 修复旧版持久化站点配置导致天使动漫论坛仍被执行签到的问题
- 启动时自动过滤临时停用站点及对应失败记录

### v0.2.4 (2026-04-26)

- 暂时停用天使动漫论坛签到配置与相关权限声明
- 修复部分站点失败后仍写入当天已签到的问题
- 增强签到接口 HTTP 状态检查与登录失败识别

### v0.2.3 (2026-03-04)

- 🛡️ 新增防重复签到机制，避免同一天内多次执行
- 🔧 修复异步错误处理缺陷，提升重试机制稳定性
- 🎯 增强正则匹配健壮性，支持多种 formhash 和响应格式
- 📊 完善错误分类逻辑，更准确识别签到状态
- 💬 优化日志级别和通知消息格式，减少误报
- 📚 重构 README 文档，修复乱码并优化结构

### v0.2.2

- 初始重构版本

## 🤝 参与贡献

本人能力有限，脚本使用过程中可能遇到各种 BUG。

**欢迎提交 PR** 来修复 BUG 或添加更多网站支持！

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
