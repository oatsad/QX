/*
Quantumult X 本地脚本
[task_local]
# 三得利签到和抢购任务，每天8:40和17:40执行签到，每天9:59:59准备执行抢购
40 8,17 * * * https://raw.githubusercontent.com/your-repo/your-script-name.js, tag=三得利任务, enabled=true

# 使用说明:
1. 将此脚本保存到你的 Quantumult X 的脚本文件夹中。
2. 在 Quantumult X 的配置文件中添加上面的 [task_local] 配置。
3. 在 Quantumult X 中添加持久化数据 (或使用 BoxJS):
   - 键: sandeli
   - 值: 你的 Authorization Token (去掉 "bearer ")。多个账号用换行分隔。
     - 示例:
       8e09bfc0xxx
       770f5xxxx
   - 如需在每天上午10点抢购商品, 请在对应账号后面追加 "&商品ID&地址ID"。
     - 商品ID: 1-大麦茶, 2-黑豆茶, 3-沁莓水, 4-茉莉乌龙
     - addressId 可通过抓包添加地址接口获得。
     - 示例 (抢购大麦茶): 8e09bfc0xxx&1&123456789
   - 键: sandeli_get
   - 值: true (如果要开启上午10点的抢购功能, 就设置这个值, 否则留空或设为 false)
*/

// #region **兼容环境和工具函数**
class Env {
  constructor(name) {
    this.name = name;
    this.logs = [];
    this.startTime = new Date().getTime();
    this.log(`🔔${this.name} 开始!`);
  }

  log(...args) {
    if (args.length > 0) {
      this.logs.push(args.join(" "));
    }
    console.log(args.join(" "));
  }

  logErr(err) {
    console.log(`❗️${this.name} 出错了\n`, err);
  }

  getEnvKey(key) {
    return $prefs.readValueForKey(key);
  }

  wait(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  // Quantumult X 网络请求封装
  request(options) {
    return new Promise((resolve, reject) => {
      $httpClient.post(options, (error, response, data) => {
        if (error) {
          reject(error);
        } else {
          try {
            response.data = JSON.parse(data);
            resolve(response);
          } catch (e) {
            response.data = data;
            resolve(response);
          }
        }
      });
    });
  }

  // 封装 post 请求
  post(options) {
      // 确保 body 是字符串
      if (typeof options.body === 'object') {
          options.body = JSON.stringify(options.body);
      }
      return this.request(options);
  }

  notify(title, subtitle = '', body = '') {
      const logStr = this.logs.join('\n');
      $notification.post(title, subtitle, body + '\n' + logStr);
  }

  done() {
    const endTime = new Date().getTime();
    const duration = (endTime - this.startTime) / 1000;
    this.log(`🔔${this.name} 结束, 耗时 ${duration} 秒!`);
    $done();
  }
}
// #endregion

const $ = new Env("三得利签到");

// #region **脚本主要逻辑**

const userInfoListRaw = $.getEnvKey('sandeli');
if (!userInfoListRaw) {
  $.log('未找到ck, 请在Quantumult X中配置持久化数据 key: sandeli');
  $.done();
  throw new Error('未找到ck');
}

const userInfoList = userInfoListRaw.split('\n').filter(Boolean);
const isGetGoods = $.getEnvKey('sandeli_get') === 'true';
const requestCount = 125; // 抢购总请求次数
const getGoodsSuccessList = ['抢券成功账号列表'];

const goodsList = [
    { id: 1, name: '三得利 大麦茶15瓶', activeId: '516', goodsId: '7305855462092832768' },
    { id: 2, name: '三得利 植物茶黑豆茶15瓶', goodsId: '7316120183365910528', activeId: '522' },
    { id: 3, name: '三得利 沁莓水15瓶', activeId: '523', goodsId: '7321170253731782656' },
    { id: 4, name: '三得利 茉莉乌龙15瓶（新包装）', activeId: '456', goodsId: '7272962282673364992' }
];

if (!userInfoList.length || userInfoList[0] === '') {
  throw new Error('未找到ck');
}
$.log(`获取到${userInfoList.length}个ck`);

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

const url = {
    'signIn': '/coupon/auth/signIn',
    'userInfo': '/user/member/info',
    'goods': '/order/center/order/submit'
};

const api = {
    signIn: (token) => {
        const options = {
            url: baseUrl + url.signIn,
            headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
            body: { "miniappId": 159 }
        };
        return $.post(options);
    },
    userInfo: (token) => {
        const options = {
            url: baseUrl + url.userInfo,
            headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
            body: {}
        };
        return $.post(options);
    },
    getGoods: (cks) => {
        const [token, id, addressId] = cks.split('&');
        const goods = goodsList.find(g => g.id == id);
        if (!goods) return Promise.reject(new Error('未找到商品ID'));

        const options = {
            url: baseUrl + url.goods,
            headers: { ...baseHeaders, 'Authorization': 'bearer ' + token },
            body: {
                "businessType": "POINTS_MALL",
                "pointMallSubmitRequest": {
                    "exchangeActivityId": goods.activeId,
                    "productBizNo": goods.goodsId,
                    "discountType": "GOODS",
                    "addressId": Number(addressId)
                }
            }
        };
        return $.post(options);
    },
};

// 获取当前日期和时间的函数
function getCurrDay() {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

// 检查并等待到指定时间的函数
async function checkTime(target) {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(target.hours, target.minutes, target.seconds, target.milliseconds);
    
    let waitTime = targetTime.getTime() - now.getTime();
    
    if (waitTime > 0) {
        $.log(`距离目标时间 ${target.hours}:${target.minutes}:${target.seconds} 还有 ${Math.round(waitTime / 1000)} 秒，开始等待...`);
        await $.wait(waitTime);
    }
}

// 随机延迟函数
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const getGoods = async (cks) => {
    try {
        const [, id, , mobile] = cks.split('&');
        const goods = goodsList.find(g => g.id == id);
        if (!goods) {
            $.log(`🕊️账号[${mobile}] 商品ID[${id}] 无效`);
            return;
        }
        const goodsName = goods.name;
        $.log(`🕊️账号[${mobile}] 开始抢券 - ${goodsName} - ${getCurrDay()}`);
        
        let { data: result } = await api.getGoods(cks);
        if (result?.code == 200) {
            $.log(`🎉账号[${mobile}] - ${goodsName} - 抢券成功！返回: [${JSON.stringify(result.data)}]`);
            getGoodsSuccessList.push(`🎉账号[${mobile}] - ${goodsName} - 抢券成功！`);
        } else {
            $.log(`🚫账号[${mobile}] - ${goodsName} - 抢券失败: ${result.msg}`);
        }
    } catch (e) {
        console.log(e);
    }
};

const processTokens = async () => {
    let index = 0;
    const date = new Date();
    const hour = date.getHours();

    // 抢购模式
    if (isGetGoods && (hour === 9 || hour === 10)) { // 增加小时判断范围以防脚本启动延迟
        $.log(`当前为抢券时段,开始执行抢购任务`);
        // 1. 过滤和准备账号
        let validUserList = [];
        for (const userInfo of userInfoList) {
            const [token, goodsId, addressId] = userInfo.split('&');
            if (!goodsId || !addressId) {
                $.log(`账号【${token.substring(0, 8)}...】没有设置抢购参数,跳过`);
                continue;
            }
            try {
                const { data: infoData } = await api.userInfo(token);
                if (infoData?.code !== 200 || !infoData?.data?.phone) {
                    $.log(`账号【${token.substring(0, 8)}...】登录失效,跳过`);
                    continue;
                }
                const { currentScore, phone } = infoData.data;
                if (Number(currentScore) < 1800) {
                    $.log(`账号【${phone}】当前积分${currentScore} < 1800,跳过`);
                    continue;
                }
                validUserList.push(`${userInfo}&${phone}`);
                await $.wait(1500); // 避免请求过快
            } catch(e) {
                $.log(`账号【${token.substring(0, 8)}...】获取信息失败,跳过`);
            }
        }

        if (!validUserList.length) {
            $.log('没有符合条件的账号,结束抢购任务');
            return;
        }

        $.log(`筛选出${validUserList.length}个有效账号:`);
        $.log(validUserList.map(user => user.split('&')[3]).join('\n'));
        const count = Math.floor(requestCount / validUserList.length) || 1;
        $.log(`每个账号将尝试抢购 ${count} 次`);
        
        // 2. 等待到指定时间
        await checkTime({ hours: 9, minutes: 59, seconds: 59, milliseconds: 500 }); // 提前半秒准备
        
        // 3. 开始并发抢购
        $.log('开始执行抢购...');
        for (let i = 0; i < count; i++) {
            for (const cks of validUserList) {
                getGoods(cks); // 并发请求，不使用 await
                await $.wait(20); // 轻微错开请求
            }
        }
        
        await $.wait(10000); // 等待10秒让所有请求完成
        
        // 抢购日志合并到主日志
        const successLog = getGoodsSuccessList.join('\n');
        $.log(successLog);
        $.logs.unshift(successLog); // 将成功列表放在最前面
        return;
    }

    // 默认签到模式
    const randomTime = random(1, 300);
    $.log(`常规签到模式，随机延迟：${randomTime}秒`);
    await $.wait(randomTime * 1000);

    for (const tokens of userInfoList) {
        try {
            const token = tokens.split('&')[0];
            $.log('');
            index++;
            const { data: userData } = await api.userInfo(token);
            const mobile = userData?.data?.phone;
            if (!mobile) {
                $.log(`账号【${index}】登录失效`);
                continue;
            }
            $.log(`▶️ 账号【${index}】: ${mobile}`);
            await $.wait(2000);

            const { data: signInData } = await api.signIn(token);
            $.log(`✅ 账号【${index}】签到信息: ${signInData.msg}`);
            await $.wait(2000);

            const { data: infoData } = await api.userInfo(token);
            const currentScore = infoData?.data?.currentScore;
            $.log(`💰 账号【${index}】当前积分: ${currentScore}`);
            await $.wait(3500);

        } catch (error) {
            $.logErr(error);
        }
    }
};

(async () => {
    await processTokens();
})().catch((e) => {
    $.logErr(e);
}).finally(() => {
    $.notify('三得利任务', '', ''); // body会自动附加所有日志
    $.done();
});
// #endregion
