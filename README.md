# DSU多站自动签到 (基于Ne-21脚本重构)

在使用 [Ne-21](https://scriptcat.org/zh-CN/users/227) 发布的 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332) 时发现有几个网站使用的是同样的签到方式，于是想要一个脚本同时能签到多个网站。于是基于 [Ne-21](https://scriptcat.org/zh-CN/users/227) 发布的 [DSU每日自动签到(上云版)](https://scriptcat.org/zh-CN/script-show-page/332)，在 AI 的帮助下修改拓展了脚本功能，支持同样使用 Discuz! + DSU签到插件（dsu_paulsign） 进行签到的网站（可能？）。

添加了以下功能：

1. 手动触发菜单
    🚀 执行签到 - 手动立即执行签到

    📊 查看历史 - 查看最近10次签到记录

    🔄 立即重试失败站点 - 智能识别上次失败的站点并重试

2. 状态管理
    运行状态检测 - 防止重复执行

    错误处理优化 - 更完善的异常捕获

3. 历史记录增强
    格式化显示 - 清晰的历史记录查看

    智能重试 - 基于历史记录的失败站点重试

    记录限制 - 只保留最近20条记录

4. 用户体验优化
    操作确认 - 重要操作前确认

    状态反馈 - 实时反馈执行状态

    区分通知 - 区分正常执行和重试操作

脚本已经添加对 [Anime字幕论坛](https://bbs.acgrip.com/) 和 [天使动漫论坛](https://www.tsdm39.com/forum.php) 的支持，如果有其它网站的需求，可以自行在代码顶部 `const SITES` 添加。

代码由 [通义](https://www.tongyi.com/) 以及 [DeepSeek](https://chat.deepseek.com/) 编写。
