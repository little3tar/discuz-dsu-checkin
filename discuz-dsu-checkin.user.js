/* eslint-disable userscripts/no-invalid-headers */
// eslint-disable-next-line userscripts/no-invalid-metadata
// ==UserScript==
// @name          DSU多站自动签到 (基于Ne-21脚本重构)
// @namespace     discuz-dsu-checkin
// @homepage      https://github.com/little3tar/discuz-dsu-checkin
// @version       0.1.0
// @description   支持 油猴中文网、Anime字幕论坛、天使动漫论坛 的 DSU 每日自动签到，优化通知+风控防护+手动菜单
// @author        sakura (基于Ne-21脚本重构)
// @crontab       * */4 * * *
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
// @match         *://bbs.tampermonkey.net.cn/*
// @match         *://bbs.acgrip.com/*
// @match         *://www.tsdm39.com/*
// ==/UserScript==

const SITES = [
    {
        name: '油猴中文网',
        signPageUrl: 'https://bbs.tampermonkey.net.cn/dsu_paulsign-sign.html',
        signApiUrl: 'https://bbs.tampermonkey.net.cn/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
        referer: 'https://bbs.tampermonkey.net.cn/plugin.php?id=dsu_paulsign:sign',
        domain: '.tampermonkey.net.cn'
    },
    {
        name: 'Anime字幕论坛',
        signPageUrl: 'https://bbs.acgrip.com/dsu_paulsign-sign.html',
        signApiUrl: 'https://bbs.acgrip.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
        referer: 'https://bbs.acgrip.com/plugin.php?id=dsu_paulsign:sign',
        domain: '.bbs.acgrip.com'
    },
    {
        name: '天使动漫论坛',
        signPageUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
        signApiUrl: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1',
        referer: 'https://www.tsdm39.com/plugin.php?id=dsu_paulsign:sign',
        domain: '.tsdm39.com'
    }
];

// 风控配置
const SECURITY_CONFIG = {
    minDelay: 2000, // 最小延迟2秒
    maxDelay: 8000, // 最大延迟8秒
    maxRetries: 1,  // 最大重试次数
    timeout: 15000  // 请求超时时间
};

// 频率控制配置
const FREQUENCY_CONFIG = {
    minInterval: 4 * 60 * 60 * 1000, // 最小执行间隔4小时
    autoRunEnabled: true // 是否启用自动执行
};

// 脚本状态
let isRunning = false;

// 初始化菜单
function initMenu() {
    try {
        GM_registerMenuCommand('🚀 执行签到', startSignProcess);
        GM_registerMenuCommand('📊 查看历史', showHistory);
        GM_registerMenuCommand('🔄 立即重试失败站点', retryFailedSites);
        GM_registerMenuCommand('⚙️ 切换自动执行', toggleAutoRun);
        GM_log('菜单初始化完成');
    } catch (error) {
        GM_log('菜单初始化失败: ' + error.message);
    }
}

// 切换自动执行状态
function toggleAutoRun() {
    const current = GM_getValue('autoRunEnabled', true);
    const newState = !current;
    GM_setValue('autoRunEnabled', newState);
    alert(`自动执行已${newState ? '开启' : '关闭'}`);
    GM_log(`自动执行状态切换为: ${newState ? '开启' : '关闭'}`);
}

// 检查执行频率
function shouldExecute() {
    if (!GM_getValue('autoRunEnabled', true)) {
        GM_log('自动执行已禁用，跳过本次执行');
        return false;
    }

    const lastExecution = GM_getValue('lastExecution', 0);
    const now = Date.now();

    if (now - lastExecution < FREQUENCY_CONFIG.minInterval) {
        GM_log('距离上次执行时间过短，跳过本次执行');
        return false;
    }

    GM_setValue('lastExecution', now);
    return true;
}

// 主执行函数
async function main() {
    if (isRunning) {
        GM_notification('签到正在进行中，请稍候...');
        return;
    }

    isRunning = true;
    GM_log('开始执行多站自动签到...');

    const results = [];

    // 顺序执行，避免并发请求
    for (let i = 0; i < SITES.length; i++) {
        const site = SITES[i];

        // 站点间随机延迟（防风控）
        if (i > 0) {
            const delay = getRandomDelay();
            GM_log(`等待 ${delay / 1000} 秒后执行下一个站点...`);
            await sleep(delay);
        }

        GM_log(`开始签到: ${site.name}`);
        const result = await signSiteWithRetry(site);
        results.push(result);
    }

    // 发送汇总通知
    sendSummaryNotification(results);

    // 保存历史记录
    saveHistory(results);

    GM_log('多站签到执行完成');
    isRunning = false;
    GM_setValue('isManualExecution', false); // 重置手动执行标志
}

// 修改手动触发函数
function startSignProcess() {
    if (isRunning) {
        GM_notification('签到正在进行中，请稍候...');
        return;
    }

    GM_setValue('isManualExecution', true); // 标记为手动执行
    GM_notification('开始手动执行多站签到...');
    main().catch(error => {
        GM_notification(`签到过程出错: ${error.message}`);
        isRunning = false;
        GM_setValue('isManualExecution', false);
    });
}

// 查看历史记录
function showHistory() {
    try {
        GM_log('尝试查看历史记录...');
        const history = GM_getValue('signHistory', []);
        GM_log(`获取到历史记录条数: ${history.length}`);

        if (history.length === 0) {
            alert('暂无签到历史记录');
            return;
        }

        let historyText = '📅 签到历史记录\n\n';

        // 只显示最近5次记录
        const recentHistory = history.slice(-5).reverse();

        recentHistory.forEach((record, index) => {
            historyText += `【${record.time}】\n`;

            if (record.results && Array.isArray(record.results)) {
                record.results.forEach(result => {
                    if (typeof result === 'string') {
                        // 旧格式兼容
                        historyText += `  ${result}\n`;
                    } else if (result && typeof result === 'object') {
                        // 新格式
                        const statusIcon = result.success ? '✅' : '❌';
                        historyText += `  ${statusIcon} ${result.site || '未知站点'}: ${result.message || '无信息'}\n`;
                        if (result.points) {
                            historyText += `      ${result.points}\n`;
                        }
                    }
                });
            } else {
                historyText += `  无详细记录\n`;
            }

            historyText += '\n';
        });

        // 使用更简单的alert方式
        GM_log('准备显示历史记录对话框');
        alert(historyText);
        GM_log('历史记录显示完成');

    } catch (error) {
        GM_log('显示历史记录时出错: ' + error.message);
        alert('显示历史记录时出错: ' + error.message);
    }
}

// 重试失败站点
function retryFailedSites() {
    if (isRunning) {
        GM_notification('签到正在进行中，请稍候...');
        return;
    }

    const history = GM_getValue('signHistory', []);
    if (history.length === 0) {
        alert('暂无历史记录可用于重试');
        return;
    }

    const lastRecord = history[history.length - 1];
    const failedSites = [];

    // 提取失败的站点
    if (lastRecord.results && Array.isArray(lastRecord.results)) {
        lastRecord.results.forEach(result => {
            if (typeof result === 'string' && result.includes('❌')) {
                // 旧格式的错误记录
                const siteName = result.split(':')[0].replace('❌ ', '').trim();
                failedSites.push({ name: siteName, result: result });
            } else if (result && typeof result === 'object' && !result.success) {
                // 新格式的错误记录
                failedSites.push({ name: result.site, result: result });
            }
        });
    }

    if (failedSites.length === 0) {
        alert('上次执行没有失败的站点');
        return;
    }

    const siteNames = failedSites.map(item => item.name);
    const siteNamesText = siteNames.join(', ');

    if (confirm(`发现 ${failedSites.length} 个失败站点:\n${siteNamesText}\n\n是否立即重试？`)) {
        GM_notification(`开始重试 ${failedSites.length} 个失败站点...`);
        retrySpecificSites(siteNames);
    }
}

// 重试特定站点
async function retrySpecificSites(siteNames) {
    isRunning = true;

    const results = [];
    const sitesToRetry = SITES.filter(site => siteNames.includes(site.name));

    if (sitesToRetry.length === 0) {
        alert('未找到对应的站点配置');
        isRunning = false;
        return;
    }

    for (let i = 0; i < sitesToRetry.length; i++) {
        const site = sitesToRetry[i];

        if (i > 0) {
            const delay = getRandomDelay();
            await sleep(delay);
        }

        GM_log(`重试签到: ${site.name}`);
        const result = await signSiteWithRetry(site);
        results.push(result);
    }

    sendSummaryNotification(results, true);
    saveHistory(results);
    isRunning = false;
}

// 带重试的站点签到
function signSiteWithRetry(site, retryCount = 0) {
    return new Promise((resolve) => {
        signSite(site).then(result => {
            resolve(result);
        }).catch(error => {
            if (retryCount < SECURITY_CONFIG.maxRetries) {
                GM_log(`${site.name} 签到失败，${SECURITY_CONFIG.minDelay / 1000}秒后重试...`);
                setTimeout(() => {
                    resolve(signSiteWithRetry(site, retryCount + 1));
                }, SECURITY_CONFIG.minDelay);
            } else {
                const errorResult = {
                    site: site.name,
                    success: false,
                    message: error.message || '未知错误',
                    displayText: `❌ ${site.name}: ${error.message || '未知错误'}`
                };
                resolve(errorResult);
            }
        });
    });
}

// 单个站点签到
function signSite(site) {
    return new Promise((resolve, reject) => {
        // 第一步：获取formhash
        GM_xmlhttpRequest({
            url: site.signPageUrl,
            method: 'GET',
            timeout: SECURITY_CONFIG.timeout,
            onload: function (xhr) {
                if (xhr.status !== 200) {
                    reject(new Error(`HTTP ${xhr.status}`));
                    return;
                }

                var res = xhr.responseText;
                var formhash = getStr(res, 'formhash=', '"') ||
                    getStr(res, 'name="formhash" value="', '"');

                if (!formhash) {
                    reject(new Error('formhash获取失败'));
                    return;
                }

                // 第二步：提交签到
                submitSign(site, formhash).then(resolve).catch(reject);
            },
            onerror: function () {
                reject(new Error('网络错误'));
            },
            ontimeout: function () {
                reject(new Error('请求超时'));
            }
        });
    });
}

// 提交签到请求
function submitSign(site, formhash) {
    return new Promise((resolve, reject) => {
        // 随机化签到参数（防风控）
        const qdxq = ['kx', 'ng', 'ym', 'wl', 'nu', 'ch', 'fd', 'yl', 'shuai'][Math.floor(Math.random() * 7)];
        const todaysay = encodeURIComponent(getRandomSignText());
        const fastreply = Math.random() > 0.5 ? 0 : 1; // 随机选择是否快速回复

        const postData = 'formhash=' + encodeURIComponent(formhash) +
            '&qdxq=' + qdxq +
            '&qdmode=1' +
            '&todaysay=' + todaysay +
            '&fastreply=' + fastreply;

        GM_xmlhttpRequest({
            method: 'POST',
            url: site.signApiUrl,
            data: postData,
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Referer': site.referer
            },
            timeout: SECURITY_CONFIG.timeout,
            onload: function (xhr) {
                console.log(xhr.responseText);
                var res = xhr.responseText.replace(/\s/g, "");
                var msg = getStr(res, '<divclass="c">', '</div></div>]]>');

                if (!msg) {
                    if (res.includes('已经签到')) {
                        msg = '今日已签到';
                    } else if (res.includes('尚未登录')) {
                        reject(new Error('未登录或Cookie失效'));
                        return;
                    } else {
                        reject(new Error('签到失败：未知响应'));
                        return;
                    }
                }

                // 解析积分信息
                const pointsInfo = parsePoints(msg);

                GM_log(site.name + "签到结果: " + msg, "info");

                resolve({
                    site: site.name,
                    success: true,
                    message: msg,
                    points: pointsInfo,
                    displayText: `✅ ${site.name}: ${pointsInfo || msg}`
                });
            },
            onerror: function () {
                reject(new Error('请求失败'));
            },
            ontimeout: function () {
                reject(new Error('请求超时'));
            }
        });
    });
}

// 发送汇总通知
function sendSummaryNotification(results, isRetry = false) {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    let notificationText = `${isRetry ? '🔄 重试结果' : '📊 签到完成'}: ${successCount}/${totalCount} 成功\n\n`;

    results.forEach(result => {
        notificationText += result.displayText + '\n';
    });

    // 添加时间戳
    const timestamp = new Date().toLocaleString();
    notificationText += `\n执行时间: ${timestamp}`;

    GM_notification({
        title: `${isRetry ? '🔄' : '📊'} 多站${isRetry ? '重试' : '签到'}完成`,
        text: notificationText,
        timeout: 10000,
    });

    GM_log(`【${isRetry ? '重试' : '签到'}结果汇总】\n` + notificationText);
}

// 解析积分信息
function parsePoints(msg) {
    const regex = /获得\s*(\d+)\s*(金币|积分|威望|铜币|银币|贡献)/i;
    const match = msg.match(regex);
    return match ? `🎁 获得: ${match[1]}${match[2]}` : null;
}

// 保存历史记录
function saveHistory(results) {
    try {
        const history = GM_getValue('signHistory', []);
        const timeStr = new Date().toLocaleString();

        const historyEntry = {
            time: timeStr,
            results: results
        };

        history.push(historyEntry);

        // 只保留最近10条记录
        if (history.length > 10) {
            history.splice(0, history.length - 10);
        }

        GM_setValue('signHistory', history);
        GM_log(`历史记录已保存，当前记录数: ${history.length}`);
    } catch (error) {
        GM_log('保存历史记录失败: ' + error.message);
    }
}

// 随机延迟函数（防风控）
function getRandomDelay() {
    return SECURITY_CONFIG.minDelay + Math.random() * (SECURITY_CONFIG.maxDelay - SECURITY_CONFIG.minDelay);
}

// 随机签到文本
function getRandomSignText() {
    const texts = [
        '签到咯~~~~~~~',
        '今天也要元气满满呀~',
        '每日签到，从不懈怠！',
        '打卡成功，奖励拿来！',
        '又是充满希望的一天！',
        '签到是一种习惯~',
        '早安，今天也要加油！',
        '晚安，明天会更好！',
        '坚持签到，收获满满',
        '快乐签到，开心每一天'
    ];
    return texts[Math.floor(Math.random() * texts.length)];
}

// 工具函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getStr(str, start, end) {
    let res = str.match(new RegExp(`${start}(.*?)${end}`));
    return res ? res[1] : null;
}

// 初始化脚本 - 每次打开浏览器都初始化菜单
initMenu();

// 启动脚本（自动执行时检查频率）
if (shouldExecute()) {
    main().catch(error => {
        GM_log('自动执行失败: ' + error.message);
    });
} else {
    GM_log('脚本已加载，等待手动执行或定时触发');
}
