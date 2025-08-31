/*
Quantumult X 本地脚本
[task_local]
# 三得利签到和抢购任务。
# 签到任务: 每天8:40和17:40执行
# 抢购任务: 如果开启，脚本会在每天上午10点前几秒开始执行
40 8,17 * * * https://raw.githubusercontent.com/your-repo/your-script-name.js, tag=三得利任务, enabled=true

# --- 使用说明 ---
# 1. 在 Quantumult X 的 "持久化数据" 中添加以下键值对 (或者使用 BoxJS 配置):
#
#    - 键 (Key): sandeli
#    - 值 (Value): 你的 Authorization Token (去掉 "bearer ")。多个账号用【换行】分隔。
#      - 示例:
#        8e09bfc0xxx
#        770f5xxxx
#
#    - 如需在每天上午10点【抢购】商品, 请在对应账号后面追加 "&商品ID&地址ID"。
#      - 商品ID: 1-大麦茶, 2-黑豆茶, 3-沁莓水, 4-茉莉乌龙
#      - addressId 可通过抓包小程序“添加地址”接口获得。
#      - 示例 (抢购大麦茶): 8e09bfc0xxx&1&123456789
#
#    - 键 (Key): sandeli_get
#    - 值 (Value): true
#      - (如果要开启上午10点的抢购功能, 就设置这个值, 否则留空或设为 false)
#
*/

const $ = new Env("三得利任务");

// --- 用户配置读取 ---
const userInfoListRaw = ($.isNode() ? process.env.sandeli : $.getdata('sandeli')) || '';
const isGetGoods = ($.isNode() ? process.env.sandeli_get : $.getdata('sandeli_get')) === 'true';

// --- 全局常量 ---
const userInfoList = userInfoListRaw.split('\n').filter(Boolean);
const requestCount = 125; // 抢购总请求次数

const goodsList = [
    { id: 1, name: '三得利 大麦茶15瓶', activeId: '516', goodsId: '7305855462092832768' },
    { id: 2, name: '三得利 植物茶黑豆茶15瓶', goodsId: '7316120183365910528', activeId: '522' },
    { id: 3, name: '三得利 沁莓水15瓶', activeId: '523', goodsId: '7321170253731782656' },
    { id: 4, name: '三得利 茉莉乌龙15瓶（新包装）', activeId: '456', goodsId: '7272962282673364992' }
];

const baseUrl = 'https://xiaodian.miyatech.com/api';
const baseHeaders = {
    'Host': 'xiaodian.miyatech.com',
    'Connection': 'keep-alive',
    'X-VERSION': '2.1.3',
    'HH-VERSION': '0.2.8',
    'componentSend': '1',
    'HH-FROM': '20230130307725',
    'HH-APP': 'wxb33ed03c6c715482',
    'appPublishType': '1',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.42(0x18002a2d) NetType/WIFI Language/zh_CN',
    'Content-Type': 'application/json;charset=UTF-8',
    'xweb_xhr': '1',
    'HH-CI': 'saas-wechat-app',
    'Accept': '*/*',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': 'https://servicewechat.com/wxb33ed03c6c715482/28/page-frame.html',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'zh-CN,zh;q=0.9'
};

// --- 主流程控制 ---
!(async () => {
    if (!userInfoList.length || userInfoList[0] === '') {
        $.log('🛑 未找到有效账号信息，请检查配置');
        return;
    }
    $.log(`获取到 ${userInfoList.length} 个账号`);
    await main();
})().catch((e) => {
    $.logErr(e);
}).finally(() => {
    $.done();
});


// --- 核心业务逻辑 ---
async function main() {
    const date = new Date();
    const hour = date.getHours();

    // 判断是否为抢购时间
    if (isGetGoods && (hour === 9 || hour === 10)) {
        await handleGetGoods();
    } else {
        await handleSignIn();
    }
}

// --- 任务: 签到 ---
async function handleSignIn() {
    $.log("\n--- ✨ 开始执行常规签到任务 ✨ ---");
    let index = 0;
    const randomTime = Math.floor(Math.random() * 200) + 1;
    $.log(`随机延迟 ${randomTime} 秒后开始...`);
    await $.wait(randomTime * 1000);

    for (const tokens of userInfoList) {
        index++;
        const token = tokens.split('&')[0];
        $.log(`\n--- [账号 ${index}] ---`);

        const userInfo = await apiUserInfo(token);
        if (!userInfo || userInfo.code !== 200 || !userInfo.data?.phone) {
            $.log(`登录失效或获取信息失败`);
            continue;
        }
        $.log(`▶️ 用户: ${userInfo.data.phone}`);
        await $.wait(2000);

        const signInResult = await apiSignIn(token);
        if (signInResult) {
            $.log(`✅ 签到: ${signInResult.msg}`);
        } else {
            $.log(`❌ 签到失败`);
        }
        await $.wait(2000);

        const finalUserInfo = await apiUserInfo(token);
        if (finalUserInfo && finalUserInfo.data) {
            $.log(`💰 当前积分: ${finalUserInfo.data.currentScore}`);
        }
        await $.wait(3500);
    }
}

// --- 任务: 抢购 ---
async function handleGetGoods() {
    $.log("\n--- 🚀 开始执行抢购任务 🚀 ---");

    // 1. 筛选和准备账号
    let validUserList = [];
    for (const userInfo of userInfoList) {
        const [token, goodsId, addressId] = userInfo.split('&');
        if (!goodsId || !addressId) {
            $.log(`账号 ${token.substring(0, 8)}... 未配置抢购参数, 已跳过`);
            continue;
        }
        const info = await apiUserInfo(token);
        if (!info || info.code !== 200 || !info.data?.phone) {
            $.log(`账号 ${token.substring(0, 8)}... 登录失效, 已跳过`);
            continue;
        }
        const { currentScore, phone } = info.data;
        if (Number(currentScore) < 1800) {
            $.log(`账号 ${phone} 积分不足 (当前 ${currentScore}), 已跳过`);
            continue;
        }
        validUserList.push(`${userInfo}&${phone}`);
        await $.wait(1500);
    }

    if (!validUserList.length) {
        $.log('没有符合抢购条件的账号, 任务结束');
        return;
    }

    $.log(`\n筛选出 ${validUserList.length} 个有效账号:`);
    validUserList.forEach(user => $.log(`- ${user.split('&')[3]}`));
    
    // 2. 计算并等待
    const count = Math.floor(requestCount / validUserList.length) || 1;
    $.log(`每个账号将尝试抢购 ${count} 次`);

    await waitTillTime({ hours: 9, minutes: 59, seconds: 59, milliseconds: 500 });
    
    // 3. 并发执行抢购
    $.log('... 时间到, 开始抢购 ...');
    let promises = [];
    for (let i = 0; i < count; i++) {
        for (const cks of validUserList) {
            // 将请求操作包装成一个立即执行的异步函数，并放入数组
            const promise = (async () => {
                const result = await apiGetGoods(cks);
                const [, id, , mobile] = cks.split('&');
                const goodsName = (goodsList.find(g => g.id == id) || {}).name || '未知商品';

                if (result?.code === 200) {
                    $.log(`🎉 [${mobile}] 抢购 ${goodsName} 成功! 返回: ${JSON.stringify(result.data)}`);
                } else {
                    $.log(`🚫 [${mobile}] 抢购 ${goodsName} 失败: ${result?.msg || '网络错误'}`);
                }
            })();
            promises.push(promise);
            await $.wait(20); // 错开请求
        }
    }
    await Promise.all(promises); // 等待所有并发请求完成
    $.log("\n抢购任务执行完毕");
}

// --- API 封装 ---
function apiSignIn(token) {
    const options = {
        url: `${baseUrl}/coupon/auth/signIn`,
        headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
        body: JSON.stringify({ "miniappId": 159 })
    };
    return apiRequest(options); // 修正: return 和 apiRequest 之间添加空格
}

function apiUserInfo(token) {
    const options = {
        url: `${baseUrl}/user/member/info`,
        headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
        body: JSON.stringify({})
    };
    return apiRequest(options); // 修正: return 和 apiRequest 之间添加空格
}

function apiGetGoods(cks) {
    const [token, id, addressId] = cks.split('&');
    const goods = goodsList.find(g => g.id == id);
    if (!goods) return Promise.resolve({ msg: '未找到商品ID配置' });

    const options = {
        url: `${baseUrl}/order/center/order/submit`,
        headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
        body: JSON.stringify({
            "businessType": "POINTS_MALL",
            "pointMallSubmitRequest": {
                "exchangeActivityId": goods.activeId,
                "productBizNo": goods.goodsId,
                "discountType": "GOODS",
                "addressId": Number(addressId)
            }
        })
    };
    return apiRequest(options); // 修正: return 和 apiRequest 之间添加空格
}

// --- 工具函数 ---

// 通用网络请求模板
function apiRequest(options) {
    return new Promise(resolve => {
        $.post(options, (err, resp, data) => {
            try {
                if (err) {
                    $.log(`❗️ API 请求失败, 请检查网络`);
                    $.log(JSON.stringify(err));
                    resolve(null);
                } else {
                    // 先判断data是否为空，避免JSON.parse出错
                    if (data) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve(null);
                    }
                }
            } catch (e) {
                $.logErr(e, resp);
                resolve(null);
            }
        });
    });
}

// 等待到指定时间
async function waitTillTime(target) {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(target.hours, target.minutes, target.seconds, target.milliseconds);
    
    let waitTime = targetTime.getTime() - now.getTime();
    
    if (waitTime > 0) {
        $.log(`⏳ 等待 ${Math.round(waitTime / 1000)} 秒至 ${target.hours}:${target.minutes}:${target.seconds}`);
        await $.wait(waitTime);
    }
}


// --- 兼容性环境 (Env.js) ---
// prettier-ignore
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise(((e,i)=>{s.call(this,t,((t,s,o)=>{t?i(t):e(s)}))}))}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null,...s){try{return JSON.stringify(t,...s)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise((e=>{this.get({url:t},((t,s,i)=>e(i)))}))}runScript(t,e){return new Promise((s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let o=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");o=o?1*o:20,o=e&&e.timeout?e.timeout:o;const[r,a]=i.split("@"),n={url:`http://${a}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:o},headers:{"X-Key":r,Accept:"*/*"},timeout:o};this.post(n,((t,e,i)=>s(i)))})).catch((t=>this.logErr(t)))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),o=JSON.stringify(this.data);s?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(e,o):this.fs.writeFileSync(t,o)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return s;return o}lodash_set(t,e,s){return Object(t)!==t||(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce(((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{}),t)[e[e.length-1]]=s),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),o=s?this.getval(s):"";if(o)try{const t=JSON.parse(o);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(e),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,o,t),s=this.setval(JSON.stringify(e),i)}catch(e){const r={};this.lodash_set(r,o,t),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.cookie&&void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)))}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&(t.opts?t.opts.redirection=!1:t.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=t;e(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",((t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}})).then((t=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:i,response:o}=t;e(i,o,o&&s.decode(o.rawBody,this.encoding))}));break}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&(t.opts?t.opts.redirection=!1:t.opts={redirection:!1})),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r,bodyBytes:a}=t;e(null,{status:s,statusCode:i,headers:o,body:r,bodyBytes:a},r,a)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:o,...r}=t;this.got[s](o,r).then((t=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:s,response:o}=t;e(s,o,o&&i.decode(o.rawBody,this.encoding))}));break}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}queryStr(t){let e="";for(const s in t){let i=t[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),e+=`${s}=${i}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",i="",o={}){const r=t=>{const{$open:e,$copy:s,$media:i,$mediaMime:o}=t;switch(typeof t){case void 0:return t;case"string":switch(this.getEnv()){case"Surge":case"Stash":default:return{url:t};case"Loon":case"Shadowrocket":return t;case"Quantumult X":return{"open-url":t};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":default:{const r={};let a=t.openUrl||t.url||t["open-url"]||e;a&&Object.assign(r,{action:"open-url",url:a});let n=t["update-pasteboard"]||t.updatePasteboard||s;if(n&&Object.assign(r,{action:"clipboard",text:n}),i){let t,e,s;if(i.startsWith("http"))t=i;else if(i.startsWith("data:")){const[t]=i.split(";"),[,o]=i.split(",");e=o,s=t.replace("data:","")}else{e=i,s=(t=>{const e={JVBERi0:"application/pdf",R0lGODdh:"image/gif",R0lGODlh:"image/gif",iVBORw0KGgo:"image/png","/9j/":"image/jpg"};for(var s in e)if(0===t.indexOf(s))return e[s];return null})(i)}Object.assign(r,{"media-url":t,"media-base64":e,"media-base64-mime":o??s})}return Object.assign(r,{"auto-dismiss":t["auto-dismiss"],sound:t.sound}),r}case"Loon":{const s={};let o=t.openUrl||t.url||t["open-url"]||e;o&&Object.assign(s,{openUrl:o});let r=t.mediaUrl||t["media-url"];return i?.startsWith("http")&&(r=i),r&&Object.assign(s,{mediaUrl:r}),console.log(JSON.stringify(s)),s}case"Quantumult X":{const o={};let r=t["open-url"]||t.url||t.openUrl||e;r&&Object.assign(o,{"open-url":r});let a=t["media-url"]||t.mediaUrl;i?.startsWith("http")&&(a=i),a&&Object.assign(o,{"media-url":a});let n=t["update-pasteboard"]||t.updatePasteboard||s;return n&&Object.assign(o,{"update-pasteboard":n}),console.log(JSON.stringify(o)),o}case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,i,r(o));break;case"Quantumult X":$notify(e,s,i,r(o));break;case"Node.js":break}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}debug(...t){this.logLevels[this.logLevel]<=this.logLevels.debug&&(t.length>0&&(this.logs=[...this.logs,...t]),console.log(`${this.logLevelPrefixs.debug}${t.map((t=>t??String(t))).join(this.logSeparator)}`))}info(...t){this.logLevels[this.logLevel]<=this.logLevels.info&&(t.length>0&&(this.logs=[...this.logs,...t]),console.log(`${this.logLevelPrefixs.info}${t.map((t=>t??String(t))).join(this.logSeparator)}`))}warn(...t){this.logLevels[this.logLevel]<=this.logLevels.warn&&(t.length>0&&(this.logs=[...this.logs,...t]),console.log(`${this.logLevelPrefixs.warn}${t.map((t=>t??String(t))).join(this.logSeparator)}`))}error(...t){this.logLevels[this.logLevel]<=this.logLevels.error&&(t.length>0&&(this.logs=[...this.logs,...t]),console.log(`${this.logLevelPrefixs.error}${t.map((t=>t??String(t))).join(this.logSeparator)}`))}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.map((t=>t??String(t))).join(this.logSeparator))}logErr(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,e,t);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,e,void 0!==t.message?t.message:t,t.stack);break}}wait(t){return new Promise((e=>setTimeout(e,t)))}done(t={}){const e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":process.exit(1)}}}(t,e)}
