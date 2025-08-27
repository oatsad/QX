/**
 * cron "39 11,19 * * *" FTEJ.js
 * export FTEJ="账号1&密码1 账号2&密码2"
 * export TEXTURL="https://api.btstu.cn/yan/api.php"
 */
const $ = new Env('福田e家');

// 请注意：由于 Quantumult X 环境不支持 Node.js 的 `crypto` 模块
// 以下混淆代码可能无法正常运行，如果核心功能依赖于此，
// 请寻找其他兼容 QX 的实现方式。
// a0e函数...
// a0d函数...
// a0c函数...

// 以下为 Quantumult X 环境兼容的脚本
!(async () => {
    let accounts = ($.getval('FTEJ') || process.env.FTEJ || '').split(' ');
    let textUrl = $.getval('TEXTURL') || process.env.TEXTURL;

    if (!accounts[0]) {
        $.msg($.name, '', '未找到账号信息，请检查环境变量 FTEJ');
        return;
    }

    for (let i = 0; i < accounts.length; i++) {
        let [username, password] = accounts[i].split('&');
        if (!username || !password) {
            console.log(`账号${i + 1}配置不完整，跳过`);
            continue;
        }
        await main(username, password);
    }
})()
    .catch((e) => $.logErr(e))
    .finally(() => $.done());

async function main(username, password) {
    $.log(`--- 正在执行账号：${username} ---`);
    try {
        // 这里是您的核心业务逻辑
        // 请在此处调用登录、签到等接口
        // 比如：
        // await login(username, password);
        // await doTask();

        // 举例：发送通知
        await $.notify('福田e家', `账号：${username} 运行成功`, `这是测试通知`);
        
    } catch (e) {
        $.logErr(e);
        await $.notify('福田e家', `账号：${username} 运行失败`, `错误：${e.message}`);
    }
}

// 模拟 QX 兼容的 Env 类，用于测试
function Env(name) {
    const is             = (key) => key.includes('ENV') ? $.getScript(key) : $.getval(key);
    const getval         = (key) => $.read_val(key);
    const setval         = (key, val) => $.write_val(key, val);
    const getScript      = (url) => $.http.get(url).then(res => res.body);
    const msg            = (title, subTitle, desc) => $.notify(title, subTitle, desc);
    const log            = (message) => console.log(message);
    const logErr         = (message) => console.error(message);
    const done           = () => {}; // QX会自动调用
    
    return {
        name,
        is,
        getval,
        setval,
        getScript,
        msg,
        log,
        logErr,
        done
    };
}
