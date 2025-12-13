// ==UserScript==
// @name          DSU多站自动签到 (基于Ne-21脚本重构)
// @namespace     discuz-dsu-checkin-enhanced
// @source        https://github.com/little3tar/discuz-dsu-checkin
// @website       https://scriptcat.org/zh-CN/script-show-page/4495
// @version       0.2.2
// @description   支持油猴中文网、Anime字幕论坛、天使动漫论坛的DSU每日自动签到
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
        {
            name: '天使动漫论坛',
            signPageUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
            signApiUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
            referer: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
            domain: '.tsdm39.com',
            enabled: true
        }
    ];

    // 重试配置
    const RETRY_CONFIG = {
        maxRetries: 3,
        retryDelay: 2000,
        timeout: 10000
    };

    // 存储键名
    const STORAGE_KEYS = {
        SITE_CONFIG: 'site_config',
        FAILED_SITES: 'failed_sites'
    };

    // 初始化存储
    function initStorage() {
        if (!GM_getValue(STORAGE_KEYS.SITE_CONFIG)) {
            GM_setValue(STORAGE_KEYS.SITE_CONFIG, SITES);
        }
        if (!GM_getValue(STORAGE_KEYS.FAILED_SITES)) {
            GM_setValue(STORAGE_KEYS.FAILED_SITES, []);
        }
    }

    // 正则匹配工具函数
    function getStr(str, start, end) {
        let res = str.match(new RegExp(`${start}(.*?)${end}`));
        return res ? res[1] : null;
    }

    // 获取站点配置
    function getSiteConfig() {
        return GM_getValue(STORAGE_KEYS.SITE_CONFIG, SITES);
    }

    // 获取失败站点列表
    function getFailedSites() {
        return GM_getValue(STORAGE_KEYS.FAILED_SITES, []);
    }

    // 更新失败站点列表
    function updateFailedSites(failedSites) {
        GM_setValue(STORAGE_KEYS.FAILED_SITES, failedSites);
    }

    // 带重试的单个站点签到
    async function signSiteWithRetry(site, retryCount = 0) {
        return new Promise((resolve, reject) => {
            GM_log(`开始签到: ${site.name}${retryCount > 0 ? ` (第${retryCount + 1}次重试)` : ''}`, "info");

            // 第一步：获取formhash
            GM_xmlhttpRequest({
                url: site.signPageUrl,
                method: 'GET',
                timeout: RETRY_CONFIG.timeout,
                onload: function (xhr) {
                    if (xhr.status !== 200) {
                        const errorMsg = `网络错误: ${xhr.status}`;
                        GM_log(`${site.name} 获取formhash失败: ${errorMsg}`, "warn");

                        if (retryCount < RETRY_CONFIG.maxRetries) {
                            setTimeout(() => {
                                resolve(signSiteWithRetry(site, retryCount + 1));
                            }, RETRY_CONFIG.retryDelay);
                        } else {
                            resolve({
                                success: false,
                                message: errorMsg,
                                retried: retryCount
                            });
                        }
                        return;
                    }

                    var res = xhr.responseText;
                    var formhash = getStr(res, 'formhash=', '"');

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
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: site.signApiUrl,
                        data: 'formhash=' + encodeURIComponent(formhash) + '&qdxq=kx&qdmode=1&todaysay=' + encodeURIComponent('签到咯~~~~~~~') + '&fastreply=0',
                        headers: {
                            'content-type': 'application/x-www-form-urlencoded',
                            'Referer': site.referer
                        },
                        timeout: RETRY_CONFIG.timeout,
                        onload: function (xhr_1) {
                            var res_1 = xhr_1.responseText.replace(/\s/g, "");
                            var msg = getStr(res_1, '<divclass="c">', '</div></div>]]>');

                            if (!msg) {
                                const errorMsg = '签到失败，可能登录失效';
                                GM_log(`${site.name} ${errorMsg}`, "warn");

                                if (retryCount < RETRY_CONFIG.maxRetries) {
                                    setTimeout(() => {
                                        resolve(signSiteWithRetry(site, retryCount + 1));
                                    }, RETRY_CONFIG.retryDelay);
                                } else {
                                    resolve({
                                        success: false,
                                        message: errorMsg,
                                        retried: retryCount
                                    });
                                }
                                return;
                            }

                            // 新增：检查返回的消息是否表示真正的签到成功
                            const successIndicators = ['恭喜您签到成功', '签到成功', '您今日已经签到'];
                            const failureIndicators = ['签到时间还没有到', '请在.*后重新进行签到'];

                            let isRealSuccess = false;
                            let isKnownFailure = false;

                            for (const indicator of successIndicators) {
                                if (msg.includes(indicator)) {
                                    isRealSuccess = true;
                                    break;
                                }
                            }

                            for (const indicator of failureIndicators) {
                                const regex = new RegExp(indicator);
                                if (regex.test(msg)) {
                                    isKnownFailure = true;
                                    break;
                                }
                            }

                            if (isRealSuccess) {
                                GM_log(`${site.name} 签到成功: ${msg}`, "info");
                                resolve({
                                    success: true,
                                    message: msg,
                                    retried: retryCount
                                });
                            } else if (isKnownFailure) {
                                GM_log(`${site.name} 签到失败(已知原因): ${msg}`, "warn");
                                resolve({
                                    success: false,
                                    message: msg,
                                    retried: retryCount
                                });
                            } else {
                                // 其他情况，可能是未知的成功或失败情况
                                GM_log(`${site.name} 签到结果不确定: ${msg}`, "warn");
                                resolve({
                                    success: false,
                                    message: `签到结果不确定: ${msg}`,
                                    retried: retryCount
                                });
                            }
                        },
                        onerror: function (error) {
                            const errorMsg = `请求失败: ${error}`;
                            GM_log(`${site.name} ${errorMsg}`, "warn");

                            if (retryCount < RETRY_CONFIG.maxRetries) {
                                setTimeout(() => {
                                    resolve(signSiteWithRetry(site, retryCount + 1));
                                }, RETRY_CONFIG.retryDelay);
                            } else {
                                resolve({
                                    success: false,
                                    message: errorMsg,
                                    retried: retryCount
                                });
                            }
                        },
                        ontimeout: function () {
                            const errorMsg = '请求超时';
                            GM_log(`${site.name} ${errorMsg}`, "warn");

                            if (retryCount < RETRY_CONFIG.maxRetries) {
                                setTimeout(() => {
                                    resolve(signSiteWithRetry(site, retryCount + 1));
                                }, RETRY_CONFIG.retryDelay);
                            } else {
                                resolve({
                                    success: false,
                                    message: errorMsg,
                                    retried: retryCount
                                });
                            }
                        }
                    });
                },
                onerror: function (error) {
                    const errorMsg = `获取页面失败: ${error}`;
                    GM_log(`${site.name} ${errorMsg}`, "warn");

                    if (retryCount < RETRY_CONFIG.maxRetries) {
                        setTimeout(() => {
                            resolve(signSiteWithRetry(site, retryCount + 1));
                        }, RETRY_CONFIG.retryDelay);
                    } else {
                        resolve({
                            success: false,
                            message: errorMsg,
                            retried: retryCount
                        });
                    }
                },
                ontimeout: function () {
                    const errorMsg = '获取页面超时';
                    GM_log(`${site.name} ${errorMsg}`, "warn");

                    if (retryCount < RETRY_CONFIG.maxRetries) {
                        setTimeout(() => {
                            resolve(signSiteWithRetry(site, retryCount + 1));
                        }, RETRY_CONFIG.retryDelay);
                    } else {
                        resolve({
                            success: false,
                            message: errorMsg,
                            retried: retryCount
                        });
                    }
                }
            });
        });
    }

    // 批量签到
    async function batchSign() {
        const sites = getSiteConfig().filter(site => site.enabled);
        const results = [];
        const failedSites = [];

        GM_log(`开始批量签到，共 ${sites.length} 个站点`, "info");

        for (const site of sites) {
            try {
                const result = await signSiteWithRetry(site);
                results.push({
                    site: site.name,
                    ...result
                });

                if (!result.success) {
                    failedSites.push(site.name);
                }

                // 延迟一下，避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorResult = {
                    site: site.name,
                    success: false,
                    message: `异常错误: ${error}`,
                    retried: 0
                };
                results.push(errorResult);
                failedSites.push(site.name);
            }
        }

        // 保存失败站点列表
        updateFailedSites(failedSites);

        // 推送汇总通知
        const successCount = results.filter(r => r.success).length;
        const totalCount = results.length;

        if (failedSites.length === 0) {
            GM_notification('签到完成', `全部成功！${successCount}/${totalCount} 个站点`);
        } else {
            GM_notification('签到完成', `成功: ${successCount}/${totalCount} 个站点\n失败: ${failedSites.join(', ')}`);
        }

        return results;
    }

    // 立即执行签到（强制重新签到所有站点）
    function executeSignNow() {
        GM_notification('开始签到', '正在强制重新签到所有站点...');

        // 清除之前的失败记录，强制重新签到所有站点
        updateFailedSites([]);

        // 直接调用batchSign，它内部已经包含通知逻辑
        batchSign();
    }

    // 重试失败站点
    async function retryFailedSites() {
        const failedSites = getFailedSites();

        if (failedSites.length === 0) {
            GM_notification('重试失败站点', '没有需要重试的失败站点');
            return;
        }

        const sites = getSiteConfig().filter(site => failedSites.includes(site.name));
        const results = [];
        const stillFailedSites = [];

        GM_notification('开始重试', `正在重试 ${failedSites.length} 个失败站点`);

        for (const site of sites) {
            try {
                const result = await signSiteWithRetry(site);
                results.push({
                    site: site.name,
                    ...result
                });

                if (!result.success) {
                    stillFailedSites.push(site.name);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                const errorResult = {
                    site: site.name,
                    success: false,
                    message: `重试异常: ${error}`,
                    retried: 0
                };
                results.push(errorResult);
                stillFailedSites.push(site.name);
            }
        }

        // 更新失败站点列表
        updateFailedSites(stillFailedSites);

        const successCount = results.filter(r => r.success).length;

        if (stillFailedSites.length === 0) {
            // 重试成功后所有网站都成功，运行批量签到成功的逻辑
            const allSites = getSiteConfig().filter(site => site.enabled);
            const successCount = allSites.length;
            const totalCount = allSites.length;
            GM_notification('签到完成', `全部成功！${successCount}/${totalCount} 个站点`);
        } else {
            GM_notification('重试完成', `成功重试: ${successCount}/${failedSites.length} 个站点\n仍然失败: ${stillFailedSites.join(', ')}`);
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

        // 自动执行签到（无论是否定时任务）
        GM_log('脚本已加载，开始自动签到', "info");
        batchSign().then(results => {
            const successCount = results.filter(r => r.success).length;
            const totalCount = results.length;
            GM_log(`自动签到完成: ${successCount}/${totalCount} 成功`, "info");
        });

        GM_log('DSU多站自动签到脚本已加载', "info");
    }

    // 启动脚本
    main();
})();