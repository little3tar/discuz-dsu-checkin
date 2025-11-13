# DSU多站自动签到 (基于Ne-21脚本重构)

代码主要由 [DeepSeek](https://chat.deepseek.com/) 编写。

## 写在前面的话

本人能力有限，做出的测试并不多，脚本使用过程中可能遇到各种各样的 BUG。

脚本已经在 [GitHub](https://github.com/little3tar/discuz-dsu-checkin) 开源，**请一定要来**修复某个 BUG 或完善添加更多支持的网站，拜托拜托ᓚᘏᗢ

## 背景

此脚本基于[Ne-21](https://scriptcat.org/zh-CN/users/227) 发布的 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332)，在 AI 的帮助下拓展了脚本的功能，现在支持同样使用 Discuz! + DSU签到插件（dsu_paulsign） 进行签到的网站（可能？）。

## 支持的网站

脚本内置支持以下网站：

1. **油猴中文网** - <https://bbs.tampermonkey.net.cn>
2. **Anime字幕论坛** - <https://bbs.acgrip.com>  
3. **天使动漫论坛** - <https://www.tsdm39.com>

可以通过修改脚本顶部 `const SITES` 配置来添加更多支持 DSU 签到的网站，或者通过设置 `enabled` 参数为 `true/false` 来控制是否启用特定网站的签到功能。

## 使用方法

脚本安装后会自动运行，提供以下功能：

### 自动签到

- 脚本加载时自动执行批量签到
- 支持定时任务（通过 `@crontab * * once * *` 配置）

### 手动操作菜单

在浏览器扩展菜单中可以看到以下选项：

- **🚀 立即签到** - 手动强制执行全部签到任务
- **⚡ 重试失败站点** - 重试上次签到失败的网站

## 配置说明

### 站点配置

在脚本顶部 `const SITES` 数组中添加新网站：

```javascript
{
    name: '网站名称',
    signPageUrl: '签到页面URL',
    signApiUrl: '签到API URL',
    referer: 'Referer头',
    domain: 'Cookie域',
    enabled: true  // 是否启用
}
```

### 重试配置

在 `const RETRY_CONFIG` 中配置：

- `maxRetries`: 最大重试次数
- `retryDelay`: 重试间隔时间（毫秒）
- `timeout`: 请求超时时间（毫秒）

## 注意事项

1. **登录状态**: 脚本依赖浏览器缓存的登录信息，使用前请确保已在支持的网站登录
2. **Cookie权限**: 脚本需要访问相关网站的 Cookie，安装时会请求权限
3. **Anime字幕论坛**: 该网站风控较严格，可能需要人机验证，建议先手动访问网站

## 已知问题

- 打开浏览器必须运行一次才能看到手动触发菜单
- 某些网站可能需要先手动访问才能正常签到
- 网络不稳定时可能导致签到失败

## 技术实现

### 签到流程

1. 获取签到页面的 `formhash` 值
2. 使用获取到的 `formhash` 提交签到请求
3. 解析返回结果，判断签到是否成功

### 重试策略

- 网络错误时自动重试
- 获取 `formhash` 失败时重试
- 签到请求失败时重试
- 超过最大重试次数后记录为失败

### 数据存储

使用 Tampermonkey 的 `GM_setValue` 和 `GM_getValue` API 存储：

- 站点配置信息
- 失败站点列表
- 签到历史记录

## 贡献指南

欢迎提交 Issue 和 Pull Request 来：

- 报告 BUG
- 添加新网站支持
- 改进代码质量
- 优化用户体验

## 免责声明

本脚本仅供学习研究使用，使用脚本请遵守相关网站的服务条款。因使用本脚本造成的任何问题，开发者不承担任何责任。
