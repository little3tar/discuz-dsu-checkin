// ==UserScript==
// @name          DSU多站自动签到 (基于Ne-21脚本重构)
// @namespace     discuz-dsu-checkin-enhanced
// @source        https://github.com/little3tar/discuz-dsu-checkin
// @website       https://scriptcat.org/zh-CN/script-show-page/4495
// @version       0.2.6
// @description   支持油猴中文网、Anime字幕论坛的DSU每日自动签到
// @author        sakura (基于Ne-21脚本重构)
// @crontab       * 1-23 once * *
// @grant         GM_notification
// @grant         GM_xmlhttpRequest
// @grant         GM_log
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @exportcookie  domain=.tampermonkey.net.cn
// @exportcookie  domain=.bbs.acgrip.com
// 天使动漫论坛暂时关闭，相关权限与站点配置临时停用。
// @exportcookie  domain=.tsdm39.com
// @connect       bbs.tampermonkey.net.cn
// @connect       bbs.acgrip.com
// @connect       www.tsdm39.com
// ==/UserScript==

(function () {
    'use strict';

    // 站点配置
    const SITES = [
        {
            name: '油猴中文网',
            signPageUrl: 'https://bbs.tampermonkey.net.cn/dsu_paulsign-sign.html',
            signApiUrl: 'https://bbs.tampermonkey.net.cn/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
            referer: 'https://bbs.tampermonkey.net.cn/plugin.php?id=dsu_paulsign:sign',
            domain: '.tampermonkey.net.cn',
            enabled: true
        },
        {
            name: 'Anime字幕论坛',
            signPageUrl: 'https://bbs.acgrip.com/dsu_paulsign-sign.html',
            signApiUrl: 'https://bbs.acgrip.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
            referer: 'https://bbs.acgrip.com/plugin.php?id=dsu_paulsign:sign',
            domain: '.bbs.acgrip.com',
            enabled: true
        },
        // 天使动漫论坛暂时关闭，先保留配置供后续恢复。
        // {
        //     name: '天使动漫论坛',
        //     signPageUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
        //     signApiUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
        //     referer: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
        //     domain: '.tsdm39.com',
        //     enabled: true
        // }
    ];

    // 临时停用站点：用于过滤旧版本已经写入 GM 存储的站点配置。
    const TEMP_DISABLED_SITES = ['天使动漫论坛'];

    // 重试配置
    const RETRY_CONFIG = {
        maxRetries: 3,
        retryDelay: 2000,
        timeout: 10000
    };

    // 签到配置
    const SIGN_CONFIG = {
        moods: ['kx', 'ng', 'ym', 'wl', 'nu', 'ch', 'fd', 'yl', 'shuai'], // 心情参数（网站规定）
        sayings: [
            '今天也要加油鸭~',
            '签到咯~',
            '每日打卡！',
            '来签到啦！',
            '新的一天开始了',
            '日常报到~',
            '打卡成功！'
        ],
        requestDelay: 1000, // 请求间隔（毫秒）
        reasonMaxLength: 15 // 失败原因最大显示长度
    };

    // 存储键名
    const STORAGE_KEYS = {
        SITE_CONFIG: 'site_config',
        FAILED_SITES: 'failed_sites',
        LAST_SIGN_DATE: 'last_sign_date'
    };

    function isTemporarilyDisabledSite(siteName) {
        return TEMP_DISABLED_SITES.includes(siteName);
    }

    function notify(title, text) {
        GM_notification({ title, text });
    }

    function normalizeSiteConfig(storedSites) {
        if (!Array.isArray(storedSites)) {
            return SITES.filter(site => !isTemporarilyDisabledSite(site.name));
        }

        const storedSitesByName = new Map(storedSites.map(site => [site.name, site]));
        return SITES
            .filter(site => !isTemporarilyDisabledSite(site.name))
            .map(site => {
                const storedSite = storedSitesByName.get(site.name);
                if (!storedSite) {
                    return site;
                }

                return {
                    ...site,
                    enabled: typeof storedSite.enabled === 'boolean' ? storedSite.enabled : site.enabled
                };
            });
    }

    // 初始化存储
    function initStorage() {
        const siteConfig = normalizeSiteConfig(GM_getValue(STORAGE_KEYS.SITE_CONFIG, SITES));
        GM_setValue(STORAGE_KEYS.SITE_CONFIG, siteConfig);

        if (!GM_getValue(STORAGE_KEYS.FAILED_SITES)) {
            GM_setValue(STORAGE_KEYS.FAILED_SITES, []);
        } else {
            GM_setValue(
                STORAGE_KEYS.FAILED_SITES,
                GM_getValue(STORAGE_KEYS.FAILED_SITES, []).filter(siteName => !isTemporarilyDisabledSite(siteName))
            );
        }
        if (!GM_getValue(STORAGE_KEYS.LAST_SIGN_DATE)) {
            GM_setValue(STORAGE_KEYS.LAST_SIGN_DATE, '');
        }
    }

    // 检查今天是否已签到
    function hasSignedToday() {
        const lastSignDate = GM_getValue(STORAGE_KEYS.LAST_SIGN_DATE, '');
        const today = new Date().toDateString();
        return lastSignDate === today;
    }

    // 更新签到日期
    function updateSignDate() {
        GM_setValue(STORAGE_KEYS.LAST_SIGN_DATE, new Date().toDateString());
    }

    // 正则匹配工具函数
    function getStr(str, start, end) {
        const startIdx = str.indexOf(start);
        if (startIdx === -1) return null;
        const contentStart = startIdx + start.length;
        const endIdx = str.indexOf(end, contentStart);
        return endIdx === -1 ? null : str.substring(contentStart, endIdx);
    }

    // 提取 formhash（支持多种格式）
    function extractFormhash(html) {
        // 尝试多种匹配模式
        const patterns = [
            /formhash=([a-f0-9]+)"/i,
            /formhash=([a-f0-9]+)'/i,
            /formhash["\s]*:["\s]*([a-f0-9]+)/i,
            /<input[^>]*name=["']formhash["'][^>]*value=["']([a-f0-9]+)["']/i
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    // 提取签到响应消息
    function extractSignMessage(html) {
        const cleanHtml = html.replace(/\s/g, "");

        // 尝试多种提取模式
        const patterns = [
            /<divclass="c">([^<]+)<\/div>/i,
            /<divid="messagetext"[^>]*>([^<]+)<\/div>/i,
            /CDATA\[([^\]]+)\]\]>/i
        ];

        for (const pattern of patterns) {
            const match = cleanHtml.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    // 随机获取签到语
    function getRandomSaying() {
        return SIGN_CONFIG.sayings[Math.floor(Math.random() * SIGN_CONFIG.sayings.length)];
    }

    // 随机获取心情参数
    function getRandomMood() {
        return SIGN_CONFIG.moods[Math.floor(Math.random() * SIGN_CONFIG.moods.length)];
    }

    // 缩短失败原因描述
    function shortenReason(message) {
        if (!message) return '未知错误';
        const msg = message.trim();
        if (msg.includes('无法获取formhash') || msg.includes('登录失效')) {
            return '登录失效';
        }
        if (msg.includes('签到时间还没有到') || msg.includes('时间未到')) {
            return '时间未到';
        }
        if (msg.includes('网络错误')) {
            return '网络错误';
        }
        if (msg.includes('请求超时') || msg.includes('获取页面超时') || msg.includes('超时')) {
            return '超时';
        }
        if (msg.includes('获取页面失败') || msg.includes('页面失败')) {
            return '页面失败';
        }
        if (msg.includes('签到结果不确定')) {
            return '未知错误';
        }
        // 默认截断
        return msg.length > SIGN_CONFIG.reasonMaxLength ? msg.substring(0, SIGN_CONFIG.reasonMaxLength) + '...' : msg;
    }

    // 获取站点配置
    function getSiteConfig() {
        const siteConfig = normalizeSiteConfig(GM_getValue(STORAGE_KEYS.SITE_CONFIG, SITES));
        GM_setValue(STORAGE_KEYS.SITE_CONFIG, siteConfig);
        return siteConfig;
    }

    // 获取失败站点列表
    function getFailedSites() {
        return GM_getValue(STORAGE_KEYS.FAILED_SITES, []);
    }

    // 更新失败站点列表
    function updateFailedSites(failedSites) {
        GM_setValue(STORAGE_KEYS.FAILED_SITES, failedSites);
    }

    // 处理请求错误并决定是否重试
    async function handleRequestError(site, errorMsg, retryCount, resolve) {
        GM_log(`${site.name} ${errorMsg}`, "warn");

        if (retryCount < RETRY_CONFIG.maxRetries) {
            setTimeout(async () => {
                const result = await signSiteWithRetry(site, retryCount + 1);
                resolve(result);
            }, RETRY_CONFIG.retryDelay);
        } else {
            resolve({
                success: false,
                message: errorMsg,
                retried: retryCount
            });
        }
    }

    // 带重试的单个站点签到
    async function signSiteWithRetry(site, retryCount = 0) {
        return new Promise((resolve) => {
            GM_log(`开始签到: ${site.name}${retryCount > 0 ? ` (第${retryCount + 1}次重试)` : ''}`, "info");

            // 第一步：获取formhash
            GM_xmlhttpRequest({
                url: site.signPageUrl,
                method: 'GET',
                timeout: RETRY_CONFIG.timeout,
                onload: function (xhr) {
                    if (xhr.status !== 200) {
                        handleRequestError(site, `网络错误: ${xhr.status}`, retryCount, resolve);
                        return;
                    }

                    const formhash = extractFormhash(xhr.responseText);

                    if (!formhash) {
                        const errorMsg = '无法获取formhash，可能已签到或登录失效';
                        GM_log(`${site.name} ${errorMsg}`, "warn");
                        resolve({
                            success: false,
                            message: errorMsg,
                            retried: retryCount
                        });
                        return;
                    }

                    // 第二步：提交签到
                    const signData = `formhash=${encodeURIComponent(formhash)}&qdxq=${getRandomMood()}&qdmode=1&todaysay=${encodeURIComponent(getRandomSaying())}&fastreply=0`;

                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: site.signApiUrl,
                        data: signData,
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded',
                            'Referer': site.referer
                        },
                        timeout: RETRY_CONFIG.timeout,
                        onload: function (signXhr) {
                            if (signXhr.status !== 200) {
                                handleRequestError(site, `网络错误: ${signXhr.status}`, retryCount, resolve);
                                return;
                            }

                            const msg = extractSignMessage(signXhr.responseText);

                            if (!msg) {
                                handleRequestError(site, '签到失败，可能登录失效', retryCount, resolve);
                                return;
                            }

                            // 检查返回的消息是否表示真正的签到成功
                            const successIndicators = ['恭喜您签到成功', '签到成功', '您今日已经签到', '已经签到', '打卡成功'];
                            const failureIndicators = ['签到时间还没有到', '请在.*后重新进行签到', '时间未到', '需要先登录', '登录后才能继续', '请先登录'];

                            const isSuccess = successIndicators.some(indicator => msg.includes(indicator));
                            const isKnownFailure = failureIndicators.some(indicator => new RegExp(indicator).test(msg));

                            if (isSuccess) {
                                GM_log(`${site.name} 签到成功: ${msg}`, "info");
                                resolve({
                                    success: true,
                                    message: msg,
                                    retried: retryCount
                                });
                            } else if (isKnownFailure) {
                                GM_log(`${site.name} 签到失败: ${msg}`, "info");
                                resolve({
                                    success: false,
                                    message: msg,
                                    retried: retryCount
                                });
                            } else {
                                GM_log(`${site.name} 签到结果未知: ${msg}`, "warn");
                                resolve({
                                    success: false,
                                    message: `签到结果未知: ${msg}`,
                                    retried: retryCount
                                });
                            }
                        },
                        onerror: () => handleRequestError(site, '请求失败', retryCount, resolve),
                        ontimeout: () => handleRequestError(site, '请求超时', retryCount, resolve)
                    });
                },
                onerror: () => handleRequestError(site, '获取页面失败', retryCount, resolve),
                ontimeout: () => handleRequestError(site, '获取页面超时', retryCount, resolve)
            });
        });
    }

    // 批量签到
    async function batchSign(forceSign = false) {
        // 检查是否今天已签到（除非强制签到）
        if (!forceSign && hasSignedToday()) {
            GM_log('今天已经签到过，跳过自动签到', "info");
            return [];
        }

        const sites = getSiteConfig().filter(site => site.enabled);
        const results = [];
        const failedEntries = []; // {name, reason}

        GM_log(`开始批量签到，共 ${sites.length} 个站点`, "info");

        for (const site of sites) {
            try {
                const result = await signSiteWithRetry(site);
                results.push({
                    site: site.name,
                    ...result
                });

                if (!result.success) {
                    const shortReason = shortenReason(result.message);
                    failedEntries.push({
                        name: site.name,
                        reason: shortReason
                    });
                }

                // 延迟一下，避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, SIGN_CONFIG.requestDelay));
            } catch (error) {
                const errorResult = {
                    site: site.name,
                    success: false,
                    message: `异常错误: ${error}`,
                    retried: 0
                };
                results.push(errorResult);
                const shortReason = shortenReason(errorResult.message);
                failedEntries.push({
                    name: site.name,
                    reason: shortReason
                });
            }
        }

        // 保存失败站点列表（仅名称）
        const failedSiteNames = failedEntries.map(entry => entry.name);
        updateFailedSites(failedSiteNames);

        // 推送汇总通知
        const successCount = results.filter(r => r.success).length;
        if (failedEntries.length === 0) {
            // 只有全部站点明确成功或已签到，才记录当天已签到，避免失败后当天自动任务被跳过。
            updateSignDate();
            notify('签到完成', `全部 ${successCount} 个站点签到成功！`);
        } else {
            const failureDescriptions = failedEntries.slice(0, 3).map(entry => `${entry.name}: ${entry.reason}`);
            const moreText = failedEntries.length > 3 ? ` 等${failedEntries.length}个` : '';
            const title = successCount === 0 ? '签到失败' : '签到部分失败';
            notify(title, `成功 ${successCount}/${results.length}，失败: ${failureDescriptions.join(', ')}${moreText}`);
        }

        return results;
    }

    // 立即执行签到（强制重新签到所有站点）
    function executeSignNow() {
        notify('开始签到', '正在强制重新签到所有站点...');

        // 清除之前的失败记录，强制重新签到所有站点
        updateFailedSites([]);

        // 直接调用batchSign，它内部已经包含通知逻辑
        batchSign(true);
    }

    // 重试失败站点
    async function retryFailedSites() {
        const failedSites = getFailedSites();

        if (failedSites.length === 0) {
            notify('重试失败站点', '没有需要重试的失败站点');
            return;
        }

        const sites = getSiteConfig().filter(site => failedSites.includes(site.name));
        if (sites.length === 0) {
            updateFailedSites([]);
            notify('重试失败站点', '没有可重试的启用站点');
            return;
        }

        const results = [];
        const stillFailedEntries = []; // {name, reason}

        notify('开始重试', `正在重试 ${sites.length} 个失败站点`);

        for (const site of sites) {
            try {
                const result = await signSiteWithRetry(site);
                results.push({
                    site: site.name,
                    ...result
                });

                if (!result.success) {
                    const shortReason = shortenReason(result.message);
                    stillFailedEntries.push({
                        name: site.name,
                        reason: shortReason
                    });
                }

                await new Promise(resolve => setTimeout(resolve, SIGN_CONFIG.requestDelay));
            } catch (error) {
                const errorResult = {
                    site: site.name,
                    success: false,
                    message: `重试异常: ${error}`,
                    retried: 0
                };
                results.push(errorResult);
                const shortReason = shortenReason(errorResult.message);
                stillFailedEntries.push({
                    name: site.name,
                    reason: shortReason
                });
            }
        }

        // 更新失败站点列表（仅名称）
        const stillFailedSiteNames = stillFailedEntries.map(entry => entry.name);
        updateFailedSites(stillFailedSiteNames);

        const successCount = results.filter(r => r.success).length;
        if (stillFailedEntries.length === 0) {
            updateSignDate();
            notify('重试完成', `全部 ${successCount} 个站点签到成功！`);
        } else {
            const failureDescriptions = stillFailedEntries.slice(0, 3).map(entry => `${entry.name}: ${entry.reason}`);
            const moreText = stillFailedEntries.length > 3 ? ` 等${stillFailedEntries.length}个` : '';
            notify('重试完成', `成功 ${successCount}/${results.length}，失败: ${failureDescriptions.join(', ')}${moreText}`);
        }
    }

    // 注册菜单命令
    function registerMenuCommands() {
        GM_registerMenuCommand('🚀 立即签到', executeSignNow);
        GM_registerMenuCommand('⚡ 重试失败站点', retryFailedSites);
    }

    // 主函数
    function main() {
        // 初始化存储
        initStorage();

        // 注册菜单
        registerMenuCommands();

        // 自动执行签到（带防重复检查）
        GM_log('脚本已加载，检查是否需要自动签到', "info");
        batchSign(false).then(results => {
            if (results.length > 0) {
                const successCount = results.filter(r => r.success).length;
                const totalCount = results.length;
                GM_log(`自动签到完成: ${successCount}/${totalCount} 成功`, "info");
            }
        });

        GM_log('DSU多站自动签到脚本已加载', "info");
    }

    // 启动脚本
    main();
})();
