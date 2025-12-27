/**
 * 快手自动签到脚本（多账号版）
 * 功能：自动打开快手app，切换账号并依次完成签到
 */

// 引入操作类型枚举
const OperationType = Object.freeze({
    DESC: 1,
    TEXT: 2,
    CONTAINS: 3,
    ID: 4,
    CLASS_NAME: 5,
    BOUNDS_BY_TEXT: 6,
});

// 等待无障碍服务
auto.waitFor();
auto.setMode("normal");

// 快手包名
const PKG = "com.smile.gifmaker";

// 账号配置文件路径
const ACCOUNTS_FILE = "accounts.json";

// 重试时间(分钟)
const retry_time = 1;
// 单位/进制
const unit = 3;

// 控制台显示
console.show();
console.clear();
// 获取屏幕宽高（AutoJS 4.1.1 原生方法）
let screenWidth = device.width;  // 屏幕宽度（如 1080）
let screenHeight = device.height; // 屏幕高度（如 2340）

// 常用滑动坐标（按比例计算，适配所有手机）
const SlideConfig = {
    // 左右滑动（切换视频：左滑下一个/右滑上一个，适合抖音、快手）
    LEFT_TO_RIGHT: { // 右滑（上一个视频）：从左1/5滑到右4/5
        startX: screenWidth * 0.2,  // 起始X：屏幕左侧20%位置
        startY: screenHeight * 0.5, // 起始Y：屏幕垂直中间
        endX: screenWidth * 0.8,    // 结束X：屏幕右侧80%位置
        endY: screenHeight * 0.5,   // 结束Y：保持垂直中间（水平滑动）
        duration: getRandomInt(400, 600)               // 滑动时长400毫秒
    },
    RIGHT_TO_LEFT: { // 左滑（下一个视频）：从右4/5滑到左1/5
        startX: screenWidth * 0.8,
        startY: screenHeight * 0.5,
        endX: screenWidth * 0.2,
        endY: screenHeight * 0.5,
        duration: getRandomInt(400, 600)
    },
    // 上下滑动（切换视频：上滑下一个/下滑上一个，适合部分平台）
    TOP_TO_BOTTOM: { // 下滑（上一个）：从上1/5滑到下4/5
        startX: screenWidth * 0.5,
        startY: screenHeight * 0.2,
        endX: screenWidth * 0.5,
        endY: screenHeight * 0.8,
        duration: getRandomInt(400, 600)
    },
    BOTTOM_TO_TOP: { // 上滑（下一个）：从下4/5滑到上1/5
        startX: screenWidth * 0.5,
        startY: screenHeight * 0.8,
        endX: screenWidth * 0.6,
        endY: screenHeight * 0.2,
        duration: getRandomInt(400, 600)
    }
};
/**
 * 滑动切换视频
 * @param {String} direction 滑动方向：left（左滑下一个）、right（右滑上一个）、up（上滑下一个）、down（下滑上一个）
 * @param {Number} waitTime 滑动后等待视频加载的时间（毫秒，默认2000）
 */
function switchVideo(direction) {
    let config = null;
    switch (direction.toLowerCase()) {
        case "left":
            config = SlideConfig.RIGHT_TO_LEFT; // 左滑=从右到左
            break;
        case "right":
            config = SlideConfig.LEFT_TO_RIGHT; // 右滑=从左到右
            break;
        case "up":
            config = SlideConfig.BOTTOM_TO_TOP; // 上滑=从下到上
            break;
        case "down":
            config = SlideConfig.TOP_TO_BOTTOM; // 下滑=从上到下
            break;
        default:
            toast("无效方向，支持 left/right/up/down");
            return false;
    }

    // 执行滑动（AutoJS 4.1.1 原生方法）
    try {
        swipe(config.startX+getRandomInt(1,10), config.startY+getRandomInt(1,10), config.endX+getRandomInt(1,10), config.endY+getRandomInt(1,10), config.duration);
        toast('已'+direction+'滑切换视频');
        // 滑动后等待视频加载（根据网络调整，2~3秒为宜）
        sleep(getRandomInt(1000, 2000));// 动态随机数
        return true;
    } catch (e) {
        // toast("滑动失败：" + e.message);
        console.log(e.message)
        return false;
    }
}
/**
 * 自动超时查找元素（统一查找函数）
 * @param {操作类型} type OperationType枚举值
 * @param {关键字} keyWord 查找关键字
 * @param {深度} nth 深度（可选，用于CLASS_NAME）
 * @param {索引} idx 索引（可选，用于CLASS_NAME）
 * @param {是否返回第一个} findOne 是否只返回第一个元素（默认true，CLASS_NAME类型默认false）
 * @returns 找到的元素或元素集合
 */
function $(type, keyWord, nth, idx, findOne) {
    let ele = undefined;
    let findCount = 0;
    
    // CLASS_NAME类型默认返回find()结果，其他类型默认返回findOne()结果
    let shouldFindOne = findOne !== undefined ? findOne : (type !== OperationType.CLASS_NAME);
    
    while (true) {
        switch (type) {
            case OperationType.DESC:
                ele = desc(keyWord).findOne(1000);
                break;
            case OperationType.TEXT:
                ele = text(keyWord).findOne(1000);
                break;
            case OperationType.CONTAINS:
                ele = textContains(keyWord).findOne(1000);
                break;
            case OperationType.ID:
                ele = id(keyWord).findOne(1000);
                break;
            case OperationType.CLASS_NAME:
                sleep(1000);
                let classSelector = className(keyWord);
                if (nth !== undefined) {
                    classSelector = classSelector.depth(nth);
                }
                if (idx !== undefined) {
                    classSelector = classSelector.indexInParent(idx);
                }
                if (shouldFindOne) {
                    ele = classSelector.findOne(1000);
                } else {
                    ele = classSelector.find();
                }
                break;
            case OperationType.BOUNDS_BY_TEXT:
                ele = text(keyWord).findOne(1000);
                if(ele){
                    ele = ele.bounds();
                }
                break;
            default:
                console.log('操作类型不存在：' + type);
                return null;
        }
        
        // 检查是否找到元素
        let found = false;
        if (ele) {
            if (type === OperationType.CLASS_NAME && !shouldFindOne) {
                // CLASS_NAME且返回集合时，检查集合是否为空
                found = ele.size() > 0;
            } else {
                found = true;
            }
        }
        
        if (found) {
            return ele;
        } else {
            findCount++;
            if (findCount >= retry_time * unit) {
                console.log("在" + retry_time + "分钟内未查找到该内容【" + keyWord + "】的元素");
                return null;
            } else {
                console.log('正在重试获取,获取次数:', findCount);
            }
        }
        sleep(1000);
    }
}

/**
 * 生成指定范围的随机整数
 * @param {Number} min 最小值
 * @param {Number} max 最大值
 * @return {Number} 随机整数
 */
function getRandomInt(min, max) {
    if (min > max) {
        [min, max] = [max, min];
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 随机延迟
 * @param {Number} min 最小延迟(毫秒)
 * @param {Number} max 最大延迟(毫秒)
 */
function randomSleep(min, max) {
    let delay = getRandomInt(min, max);
    sleep(delay);
}

/**
 * 打开快手app
 */
function openKuaishou() {
    console.log("正在打开快手app...");
    try {
        // 尝试通过包名启动
        app.launchPackage(PKG);
        sleep(3000);
        console.log("快手app已打开");
        return true;
    } catch (e) {
        console.log("打开快手app失败：" + e.message);
        toast("打开快手app失败");
        return false;
    }
}

/**
 * 处理可能的弹窗（同意协议、权限请求等）
 */
function handlePopups() {
    console.log("检查并处理弹窗...");
    // 处理"同意并继续"弹窗
    let agreeBtn = $(OperationType.TEXT, "同意并登录");
    if (agreeBtn) {
        agreeBtn.click();
        console.log("已点击 同意并登录");
        randomSleep(1500, 2000);
    }
}

/**
 * 进入"登录"界面
 */
function goToLogin() {
    console.log("正在进入'登录界面'")
    let otherLoginBtn = $(OperationType.ID, PKG+":id/btn_other_login_ways")
    if(otherLoginBtn){
        otherLoginBtn.click();
        console.log('已点击"以其他方式登录"按钮');
        randomSleep(800, 1000);
    }
    otherLoginBtn = $(OperationType.ID, PKG+":id/btn_other_login_ways")
    if(otherLoginBtn){
        otherLoginBtn.click();
        console.log('已点击"其他手机号码登录"按钮')
        randomSleep(800, 1000);
    }
    let pwdLoginBtn = $(OperationType.TEXT, '密码登录');
    if(pwdLoginBtn){
        pwdLoginBtn.click()
        console.log('已点击"密码登录"按钮')
        randomSleep(800, 1000);
    }
}
/**
 * 进入"首页"
 */
function goToHome() {
    console.log("正在进入'首页'页面...");
    let homeBtn = $(OperationType.TEXT, "首页");
    if (homeBtn) {
        homeBtn.click();
        console.log("已点击'首页'按钮");
        randomSleep(1000, 2000);
        return true;
    }
    return false
}
/**
 * 进入任务中心
 */
function goToTaskCenter() {
    console.log("正在进入'任务中心'页面...");
    let raskCenterBtn = $(OperationType.ID, PKG+":id/featured_left_hamburger");
    if (raskCenterBtn) {
        raskCenterBtn.click();
        console.log("已点击'左上角更多'按钮");
        randomSleep(400, 1000);
    }
    let centerBtn = $(OperationType.DESC, '任务中心');
    if(centerBtn){
        centerBtn.click();
        console.log('已点击"任务中心"按钮')
        randomSleep(500, 1500)
        return true
    }
    return false
}
function clickLocation(locatioin){
    click(locatioin.centerX()+getRandomInt(1,3), locatioin.centerY()+getRandomInt(1,3));
}
/**
 * 进入"我"页面
 */
function goToProfile() {
    console.log("正在进入'我'页面...");
    // 方法1: 通过描述文字查找"我"按钮
    let profileBtn = $(OperationType.BOUNDS_BY_TEXT, '我');
    if(profileBtn){
        clickLocation(profileBtn);
        console.log("已点击'我'按钮");
        randomSleep(1000, 2000);
        return true;
    }
    return false;
}

/**
 * 查找并点击签到入口
 */
function findSignInEntry() {
    console.log("正在查找签到入口...");
    
    // 可能的签到入口文本
    const signInKeywords = [
        "签到",
        "每日签到",
        "立即签到",
        "去签到",
        "金币",
        "领金币",
        "我的金币",
        "任务中心",
        "每日任务"
    ];
    
    for (let keyword of signInKeywords) {
        console.log("尝试查找：" + keyword);
        
        // 通过文本查找
        let signBtn = $(OperationType.TEXT, keyword);
        if (signBtn && signBtn.clickable()) {
            signBtn.click();
            console.log("已点击：" + keyword);
            randomSleep(2000, 3000);
            return true;
        }
        
        // 通过包含文本查找
        signBtn = $(OperationType.CONTAINS, keyword);
        if (signBtn && signBtn.clickable()) {
            signBtn.click();
            console.log("已点击（包含）：" + keyword);
            randomSleep(2000, 3000);
            return true;
        }
    }
    
    // 尝试查找红包图标（签到入口可能是红包图标）
    console.log("尝试查找红包图标...");
    let redPackets = $(OperationType.CLASS_NAME, "android.view.ViewGroup", undefined, undefined, false);
    if (redPackets && redPackets.size() > 0) {
        // 查找可能包含红包的控件
        for (let i = 0; i < Math.min(redPackets.size(), 10); i++) {
            let packet = redPackets.get(i);
            let bounds = packet.bounds();
            // 检查是否在屏幕上半部分（签到入口通常在顶部）
            if (bounds.top < screenHeight * 0.3) {
                packet.click();
                console.log("已点击可能的红包入口");
                randomSleep(300, 1000);
                return true;
            }
        }
    }
    
    console.log("未找到签到入口");
    return false;
}

/**
 * 执行签到操作
 */
function doSignIn() {
    console.log("正在执行签到...");
    // 查找签到按钮
    const signInBtnTexts = [
        "立即签到",
        "签到"
    ];
    for (let btnText of signInBtnTexts) {
        let signBtn = $(OperationType.BOUNDS_BY_TEXT, btnText);
        if (signBtn) {
            clickLocation(signBtn);
            console.log("已点击签到按钮：" + btnText);
            randomSleep(800, 1500);
           // 检查是否有签到成功的提示
            checkSignInResult();
            return true;
        }
    }
    console.log('[!WARN]:签到失败')
    return false;
}

/**
 * 点可领 操作 25min
 * //TODO 需要做对应账号的操作次数的记录
 */
function doGetGold() {
    let goldenBtn = $(OperationType.CONTAINS, '点可领');
    if(goldenBtn) {
        goldenBtn.click();
        console.log("已点击'点可领'按钮");
        randomSleep(800, 1500);
        // 需要通过goldenBtn获得倒计时
    }
}
/**
 * 立即领取 操作
 */
function doQuicklyCollect() {
    //无效果
    // let btn = $(OperationType.DESC, '立即领取')
    // if(btn){
    //     btn.click()
    //     console.log('已点击"立即领取"按钮')
    //     randomSleep(800, 1500)
    // }
}
/**
 * 观看广告 操作 30s
 */
function doWatchAd() {
    let adBtn = $(OperationType.BOUNDS_BY_TEXT, '领福利')
    if(adBtn){
        clickLocation(adBtn)
        console.log('点击"领福利"按钮')
        randomSleep(300, 800);
    }
}

function startAdTask(){
    let adCount = 30;
    for(let i = 0; i< adCount; i++){
        console.log('当前第'+(i+1)+'个领福利广告')
        doWatchAd()
        sleep(getRandomInt(30000, 31000));
        back();
        let closeViewBtn = $(OperationType.DESC, 'close_view');
        if(closeViewBtn){
            closeViewBtn.click();
        }else{
            console.log('请检查是否在正确的【领福利-广告-奖励界面】')
            return false;
        }
    }
    return true;
}
/**
 * 短视频 操作
 * @returns 
 */
function startWatchShortVideo() {
    let shortBtn = $(OperationType.TEXT, '看短剧')
    if(shortBtn){
        shortBtn.click()
        console.log('点击"看短剧"按钮')
        randomSleep(300, 800);
    } else {
        console.log('看短剧 按钮未找到')
        return false;
    }
    let shortTvCount = 5;
    for(let i = 0; i< shortTvCount; i++){
        console.log('当前第'+(i+1)+'个 看短剧 奖励')
        let swipeCount = 4;
        for(let i = 0; i< swipeCount; i++){
            if(switchVideo('up')){
                sleep(getRandomInt(10000, 11000));
                console.log('当前第'+(i+1)+'次滚动')
            }else{
                console.log('切换视频出现异常, 退出循环')
                break;
            }
        }
        console.log('已结束本轮视频切换，确认是否已取得奖励')
    }
    console.log('看短剧奖励获取完毕')
    back();
    randomSleep(1000, 1500);
    return true;
}

/**
 * 去领取 操作
 */
function doGoLingQu() {
    let btn = $(OperationType.TEXT, '去领取')
    if(btn){
        btn.click();
        console.log('点击"去领取"按钮')
        randomSleep(800, 1500);
    }
    //需要判断是进入了哪个入口
    let walletBtn = $(OperationType.TEXT, '钱包')
    let shareBtn = $(OperationType.TEXT, '分享')
    if(walletBtn && shareBtn){
        console.log('已完成了连续签到30天的任务, 来到了 推金币 玩法界面 直接退出')
        back()
        return true;
    }

    //判断是否出现有断签
    let giveUpBtn = text('放弃续签').findOne(1000);
    if(giveUpBtn){
        giveUpBtn.click();
        randomSleep(300, 500);
        let confirmBtn = $(OperationType.TEXT, '确认放弃')
        if(confirmBtn){
            confirmBtn.click();
            randomSleep(1000, 1500)
        }
    }
    let rushBtn = $(OperationType.CONTAINS, '好礼不限量')
    if(rushBtn){
        rushBtn.click();
        console.log('点击抢30的奖励')
        randomSleep(500, 800)
        let startChallenge = $(OperationType.TEXT, '开启挑战')
        if(startChallenge){
            startChallenge.click();
            console.log('已点击 "开始挑战"按钮')
            randomSleep(500, 800)
            // 任意点击一下
            click(screenWidth * 0.88, screenHeight * 0.55);
        }
    }
    let goToSignBtn = $(OperationType.TEXT, '去签到')
    if(goToSignBtn){
        goToSignBtn.click();
        console.log('已点击 "去签到"按钮')
        randomSleep(800, 1000)
        let resultText = $(OperationType.CONTAINS, '任务完成')
        if(resultText){
            console.log('任务完成')
        }
    }
    back();
    return true;
}

/**
 * 去搜索 操作
 */
function goToSearch() {
    console.log('前往 去搜索 页面')
    let searchBtn = $(OperationType.TEXT, '去搜索')
    if(searchBtn){
        searchBtn.click();
        console.log('已点击 "去搜索"按钮')
        return true;
    }
    return false;
}
function doGoSearch() {
    let taskBtn = $(OperationType.CONTAINS, '已完成')
    if(taskBtn){
        let taskText = taskBtn.text()
        let arr = parseText(taskText)
        if(arr){
            let completed = arr[0]
            let total = arr[1]
            for(let i = completed; i++; i<= total){
                console.log('当前第'+(i+1)+'个 去搜索 奖励 进度：'+ (completed / total))
                handlerSearchItem()
            }
            back();
            let confirmBackBtn = text('仍要退出').findOne(1000);
            if(confirmBackBtn){
                confirmBackBtn.click();
            }
        }
    }
}
// 连续失败 的记录
let continuouRecond = []
/**
 * 处理 去搜索 里面的逐个奖励
 * @returns 
 */
function handlerSearchItem(){
    let itemBtn = $(OperationType.BOUNDS_BY_TEXT, '去搜索')
    if(itemBtn){
        log('点击了任务列表中的 "去搜索" 按钮')
        clickLocation(itemBtn)
        let realAd = $(OperationType.ID, PKG+'.commercial_neo:id/count_down_gift_icon');
        if(realAd){
            randomSleep(26000, 28000)
            back()
            let closeViewBtn = desc('close_view').findOne(1000);
            if(closeViewBtn){
                closeViewBtn.click();
            }
            continuouRecond = []
        }else{
            console.log('出现了无奖励任务，重试')
            back()
            continuouRecond.push(1);
            if(continuouRecond.length >= 3){
                return false;
            }
            handlerSearchItem();
        }
    }
}
/**
 * 解析 xxx0/100
 * @param {文本} str 
 */
function parseText(str){
    let nums = str.match(/\d+/g); 
    // 3. 校验并提取数字（转换为Number类型）
    if (nums && nums.length >= 2) {
        let completed = Number(nums[0]); // 已完成数：0
        let total = Number(nums[1]);     // 总数：100
        log("进度：", completed / total); // 计算进度（0）
        return [completed, total]
    } else {
        toast("未匹配到数字！");
    }
    return undefined;
}
/**
 * 检查签到结果
 */
function checkSignInResult() {
    console.log("检查签到结果...");
    randomSleep(1000, 1500);
    
    // 查找签到成功的提示
    const successTexts = [
        "签到成功",
        "已签到",
        "签到完成",
        "领取成功",
        "已领取"
    ];
    
    for (let text of successTexts) {
        let successMsg = $(OperationType.CONTAINS, text);
        if (successMsg) {
            console.log("✓ 签到成功！");
            toast("签到成功！");
            return true;
        }
    }
    
    // 查找已签到的提示
    const alreadySignedTexts = [
        "今日已签到",
        "已签到",
        "明天再来"
    ];
    
    for (let text of alreadySignedTexts) {
        let alreadyMsg = $(OperationType.CONTAINS, text);
        if (alreadyMsg) {
            console.log("✓ 今日已签到");
            toast("今日已签到");
            return true;
        }
    }
    
    console.log("未检测到明确的签到结果");
    return false;
}

/**
 * 关闭可能的弹窗
 */
function closePopups() {
    // 查找关闭按钮
    let closeBtn = $(OperationType.CLASS_NAME,'android.widget.Image',12,0);
    if(closeBtn){
        closeBtn.click();
        console.log("已关闭弹窗");
        randomSleep(500, 1200);
    }
    // 判断是否有额外的弹窗出现
    let newCloseBtn = $(OperationType.CLASS_NAME,'android.widget.Image',12,0);
    if(newCloseBtn){
        newCloseBtn.click()
    }
}

/**
 * 读取账号配置文件
 * @returns {Array} 账号列表
 */
function loadAccounts() {
    try {
        let accountsStr = files.read(ACCOUNTS_FILE);
        let accounts = JSON.parse(accountsStr);
        console.log("成功加载账号配置，共 " + accounts.length + " 个账号");
        return accounts;
    } catch (e) {
        console.log("读取账号配置文件失败：" + e.message);
        toast("读取账号配置失败");
        return [];
    }
}

/**
 * 检查是否已登录
 * @returns {Boolean} 是否已登录
 */
function isLoggedIn() {
    // 检查是否存在"我"页面（已登录状态）
    let profileBtn = $(OperationType.ID, PKG+":id/user_name_tv");
    if (profileBtn) {
        return true;
    }
    // 检查是否存在"未登录头像"/"登录"按钮
    let loginBtn = $(OperationType.ID, PKG+":id/tv_security_phone");
    if(loginBtn){
        console.log('没有登录，存在')
        return false;
    }
    loginBtn = $(OperationType.CONTAINS, "登录");
    if (loginBtn) {
        return false;
    }
    // 默认认为已登录（可能是首页）
    return true;
}

/**
 * 退出当前账号
 */
function logout() {
    console.log("正在退出当前账号...");
    
    try {
        // 进入"我"页面
        goToProfile();
        // 点击显示设置的弹窗
        let moreBtn = $(OperationType.ID, PKG+":id/more_btn_root_layout");
        if(moreBtn){
            console.log("已点击右上角更多按钮!");
        }
        // 查找设置按钮
        let settingsBtn = $(OperationType.TEXT, "设置");
        if (!settingsBtn) {
            settingsBtn = $(OperationType.DESC, "设置");
        }
        if (settingsBtn) {
            settingsBtn.click();
            console.log("已点击设置");
            // 查找退出登录或切换账号
            let logoutBtn = $(OperationType.TEXT, "退出登录");
            if (!logoutBtn) {
                logoutBtn = $(OperationType.CONTAINS, "退出");
            }
            if (logoutBtn) {
                logoutBtn.click();
                console.log("已点击退出登录");
                // 确认退出
                let confirmBtn = $(OperationType.TEXT, "退出登录");
                if (!confirmBtn) {
                    confirmBtn = $(OperationType.TEXT, "退出");
                }
                if (confirmBtn) {
                    confirmBtn.click();
                    console.log("已确认退出");
                }
            } else {
                console.log("未找到退出登录按钮");
                back();
            }
        } else {
            console.log("未找到设置按钮，尝试强制退出");
            // 如果找不到设置，尝试关闭app重新打开
            closeApp();
            randomSleep(2000, 3000);
            openKuaishou();
        }
    } catch (e) {
        console.log("退出账号失败：" + e.message);
        // 尝试强制关闭app
        closeApp();
        randomSleep(2000, 3000);
        openKuaishou();
    }
}

/**
 * 关闭快手app
 */
function closeApp() {
    try {
        // 打开快手应用信息页
        app.openAppSetting(PKG);
        sleep(800);
        
        // 模拟点击"强制停止"按钮
        click(screenWidth * 0.88, screenHeight * 0.25);
        let stopBtn = $(OperationType.TEXT, '强行停止');
        if (stopBtn) {
            stopBtn.click();
            sleep(300);
        }
        back();
        toast("快手已退出");
    } catch (e) {
        back();
        back();
    }
}

/**
 * 登录账号
 * @param {Object} account 账号信息 {name, phone, password}
 * @returns {Boolean} 是否登录成功
 */
function login(account) {
    console.log("正在登录账号：" + account.name + " (" + account.phone + ")");
    
    try {
        // 等待登录页面加载
        randomSleep(2000, 3000);
        
        // 查找手机号输入框
        let phoneInput = $(OperationType.TEXT, "请输入手机号");
        if (!phoneInput) {
            phoneInput = $(OperationType.ID, PKG+":id/phone_et");
        }
        if (!phoneInput) {
            phoneInput = $(OperationType.CLASS_NAME, "android.widget.EditText", undefined, undefined, true);
        }
        
        if (phoneInput) {
            phoneInput.setText(account.phone);
            console.log("已输入手机号");
            randomSleep(300, 800);
        } else {
            console.log("未找到手机号输入框");
            return false;
        }
        // 输入密码
        let pwdInput = $(OperationType.ID, PKG+":id/password_et");
        if (!pwdInput) {
            // 尝试查找第二个输入框（通常是密码框）
            let inputs = $(OperationType.CLASS_NAME, "android.widget.EditText", undefined, undefined, false);
            if (inputs && inputs.size() >= 2) {
                pwdInput = inputs.get(1);
            }
        }
        
        if (pwdInput) {
            pwdInput.setText(account.password);
            console.log("已输入密码");
            randomSleep(300, 800);
        } else {
            console.log("未找到密码输入框");
            return false;
        }
        
        // 点击登录按钮
        let loginBtn = $(OperationType.ID, PKG+":id/confirm_btn");
        if (!loginBtn) {
            loginBtn = $(OperationType.TEXT, "登录");
        }
        if (loginBtn) {
            loginBtn.click();
            console.log("已点击登录按钮");
            randomSleep(500, 1000);
            // 处理可能的协议同意
            handlePopups();
            // 处理可能的验证码
            let validateBtn = $(OperationType.TEXT, "去验证");
            if (validateBtn) {
                console.log("需要验证码，请手动处理");
                toast("账号 " + account.name + " 需要验证码，请手动处理");
                // 等待用户手动处理验证码
                sleep(30000); // 等待30秒
            }
            // 检查是否登录成功
            randomSleep(3000, 4000);
            if (isLoggedIn()) {
                console.log("✓ 登录成功");
                return true;
            } else {
                console.log("登录可能失败，请检查");
                return false;
            }
        } else {
            console.log("未找到登录按钮");
            return false;
        }
    } catch (e) {
        console.log("登录过程出错：" + e.message);
        return false;
    }
}

/**
 * 单个账号的签到流程
 * @param {Object} account 账号信息
 * @returns {Boolean} 是否签到成功
 */
function signInForAccount(account) {
    console.log("\n========== 开始处理账号：" + account.name + " ==========");
    goToProfile()
    try {
        // 1. 检查是否需要登录
        if (!isLoggedIn()) {
            console.log("当前未登录，开始登录...");
            goToLogin();
            if (!login(account)) {
                console.log("登录失败，跳过该账号");
                return false;
            }
        } else {
            console.log("当前已登录，检查是否需要切换账号...");
            // 可以添加检查当前登录账号的逻辑
            // 如果账号不匹配，先退出再登录
        }
        // 3. 进入"我"页面
        if (!goToHome()) {
            console.log("进入'首页'页面失败");
            return false;
        }
        // 3 进入任务中心
        if(!goToTaskCenter()){
            console.log("进入'任务中心'页面失败");
            return false;
        }
        // 5. 执行签到
        doSignIn();
        // 6. 点可领
        doGetGold();// TODO 后续还有20个 如何解决识别倒计时 右下角宝箱图标
        // 6. 关闭弹窗
        closePopups();
        // 7. 立即领取
        // doQuicklyCollect();
        // 8. 领福利
        if(!startAdTask()){
            console.log('观看 领福利-广告奖励 出现异常，请检查')
        }
        // 9. 看短剧
        if(!startWatchShortVideo()){
            console.log('观看 看短剧-奖励 出现异常,请检查')
        }
        // 10. 去领取 挑战任务 30天 有可能进入到推金币游戏 (已处理)
        doGoLingQu();
        if(goToSearch()){
            doGoSearch();
            console.log('去搜索 奖励获取完成')
        }
        console.log('--------------------')
        return false;
        console.log("========== 账号 " + account.name + " 签到流程完成 ==========");
        return true;
        
    } catch (e) {
        console.log("处理账号 " + account.name + " 时出错：" + e.message);
        console.log("错误堆栈：" + e.stack);
        return false;
    }
}

/**
 * 主函数：执行多账号签到流程
 */
function main() {
    console.log("========== 快手多账号自动签到开始 ==========");
    console.log("时间：" + new Date().toLocaleString());
    try {
        // 1. 加载账号配置
        let accounts = loadAccounts();
        if (accounts.length === 0) {
            console.log("没有配置账号，退出");
            toast("请先配置账号信息");
            return;
        }
        // 2. 打开快手app
        if (!openKuaishou()) {
            console.log("打开app失败，退出");
            return;
        }
        // 4. 循环处理每个账号
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < 1; i++) {
            let account = accounts[i];
            console.log("\n>>> 处理第 " + (i + 1) + "/" + accounts.length + " 个账号");
            
            // 如果不是第一个账号，需要先退出当前账号
            if (i > 0) {
                console.log("切换账号，先退出当前账号...");
                logout();
                // 重新打开app（如果需要）
                if (!isLoggedIn()) {
                    // 已经在登录页面，继续
                } else {
                    // 如果还在登录状态，强制关闭重新打开
                    closeApp();
                    randomSleep(2000, 3000);
                    openKuaishou();
                    handlePopups();
                }
            }
            
            // 执行签到
            if (signInForAccount(account)) {
                successCount++;
                console.log("✓ 账号 " + account.name + " 签到成功");
            } else {
                failCount++;
                console.log("✗ 账号 " + account.name + " 签到失败");
            }
            // 账号之间延迟
            if (i < accounts.length - 1) {
                console.log("等待 " + getRandomInt(3000, 5000) + " 毫秒后处理下一个账号...");
                randomSleep(3000, 5000);
            }
        }
        
        // 5. 输出统计信息
        console.log("\n========== 签到完成统计 ==========");
        console.log("总账号数：" + accounts.length);
        console.log("成功：" + successCount);
        console.log("失败：" + failCount);
        console.log("========== 所有账号签到流程完成 ==========");
        
        toast("签到完成！成功：" + successCount + "，失败：" + failCount);
        
    } catch (e) {
        console.log("执行过程中出现错误：" + e.message);
        console.log("错误堆栈：" + e.stack);
        toast("签到失败：" + e.message);
    } finally {
        // 延迟关闭控制台，方便查看日志
        sleep(5000);
        console.hide();
    }
}

// 执行主函数
main();

