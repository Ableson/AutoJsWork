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
    TEXT_MATCHES: 7,
});
const Account = {self: undefined, watch_video: 30}
const sign_day = {label: '现金1.5元', val: 7}
// 等待无障碍服务
auto.waitFor();
auto.setMode("normal");

// 快手包名
const PKG = "com.smile.gifmaker";

// 账号配置文件路径
const ACCOUNTS_FILE = "accounts.json";

// 重试时间(分钟)
const retry_time = 0.06;
// 单位/进制
const unit = 6;

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
        endY: screenHeight * 0.1,
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
        randomSleep(1000, 2000)
        return true;
    } catch (e) {
        // toast("滑动失败：" + e.message);
        console.log(e.message)
        return false;
    }
}
/**
 * xx | xx(1500)
 * @param {*} keyWord 
 */
function parseKeyWord(keyWord){
    let reg = /^([^()]+)(?:\((\d+)\))?$/;
    let match;
    if (typeof keyWord === 'string') {
        match = keyWord.match(reg)
    }else{
        match = ['', keyWord]
    }

    let result = {
        prefix: undefined, // 前缀（如xx）
        num: retry_time * unit     // 数字（如1500，无则为空）
    };

    if (match) {
        // 提取前缀（去除首尾空格，兼容"xx (1500)"这类带空格的情况）
        if (typeof keyWord === 'string') {
            result.prefix = match[1].trim();
        }else{
            result.prefix = match[1];
        }
        // 提取数字（存在则赋值，否则为空）
        result.num = match[2] ? match[2].trim()*1/1000 : retry_time * unit;
    } else {
        toast('字符串格式不匹配！');
    }
    return result;
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
    let result = parseKeyWord(keyWord)
    keyWord = result.prefix
    retryCount = result.num
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
            case OperationType.TEXT_MATCHES:
                ele = textMatches(keyWord).findOne(1000);
                break;
            case OperationType.CLASS_NAME:
                sleep(1000);
                let classSelector = className(keyWord);
                if (nth !== undefined) {
                    classSelector = classSelector.depth(nth).clickable(true);
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
            if (findCount >= retryCount) {
                if(retry_time < 1){
                    let seconds = retryCount
                    console.log("在" + seconds + "秒内未查找到该内容【" + keyWord + "】的元素");
                }else{
                    console.log("在" + retry_time + "分钟内未查找到该内容【" + keyWord + "】的元素");
                }
                return null;
            } else {
                console.log('正在重试获取:', keyWord, '获取次数:', findCount);
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
 * 处理打开快手时出现的权限请求弹窗
 * 当 AutoJs6 通过 app.launchPackage 启动快手时，Android 系统会弹出
 * "AutoJs6想要打开 快手, 是否允许" 确认对话框，需要点击 "始终允许" 完成授权。
 * 使用 $ 自动超时查找机制监测弹窗，未检测到则静默退出，不影响后续流程。
 * @return {Boolean} 是否成功处理了权限弹窗(未出现弹窗时返回 false)
 */
function handlePermissionDialog() {
    console.log("开始监测 快手打开权限请求弹窗...");
    // 用 $ 自动超时查找权限弹窗（可能不出现，超时即跳过）
    let dialogTip = $(OperationType.CONTAINS, "想要打开");
    if (dialogTip) {
        console.log("检测到权限请求弹窗：" + dialogTip.text());
        // 查找并点击 "始终允许" 按钮
        let allowBtn = $(OperationType.TEXT, "始终允许");
        if (allowBtn) {
            allowBtn.click();
            console.log("已点击 [始终允许] 按钮，授权 AutoJs6 打开快手");
            return true;
        } else {
            console.log("未找到 [始终允许] 按钮，弹窗处理失败");
        }
    } else {
        console.log("未检测到权限请求弹窗，继续执行后续流程");
    }
    return false;
}

/**
 * 处理打开快手时出现的"同意并继续"协议弹窗
 * 首次或冷启动快手时，可能会弹出隐私协议"同意并继续"按钮，需要点击以进入app。
 * 使用 $ 自动超时查找机制监测弹窗，未检测到则静默退出，不影响后续流程。
 * @return {Boolean} 是否成功点击了"同意并继续"按钮
 */
function handleAgreeDialog() {
    console.log("开始监测 [同意并继续] 协议弹窗...");
    // 用 $ 自动超时查找协议弹窗（可能不出现，超时即跳过）
    let agreeBtn = $(OperationType.TEXT, "同意并继续");
    if (agreeBtn) {
        agreeBtn.click();
        console.log("已点击 [同意并继续] 按钮");
        return true;
    } else {
        console.log("未检测到 [同意并继续] 弹窗，继续执行后续流程");
        return false;
    }
}

/**
 * 打开快手app
 */
function openKuaishou() {
    console.log("正在打开快手app...");
    try {
        // 尝试通过包名启动
        app.launchPackage(PKG);
        // 启动后持续监测并处理 "AutoJs6想要打开 快手, 是否允许" 权限请求弹窗
        handlePermissionDialog();
        // 监测并处理 "同意并继续" 协议弹窗
        handleAgreeDialog();
        // 通过查找底部导航栏"我"按钮确认 app 已加载完成（自动超时重试，替代固定 sleep）
        let profileBtn = $(OperationType.TEXT, "我");
        if (profileBtn) {
            console.log("快手app已打开");
            return true;
        } else {
            console.log("快手app启动超时，未找到主界面元素");
            return false;
        }
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
        clickElement(agreeBtn)
        console.log("已点击 同意并登录");
    }
}

/**
 * 进入"登录"界面
 */
function goToLogin() {
    console.log("正在进入'登录界面'")
    phoneLogin();
    clickPwdBtn()
}

function agreenProtocol(){
    // 先勾选"我已阅读并同意"协议复选框，否则登录按钮无反应
    let agreeCheckbox = textContains("我已阅读并同意").findOne(2000);
    if (agreeCheckbox) {
        // 点击复选框前的圆形勾选区域
        let bounds = agreeCheckbox.bounds();
        let checkX = bounds.left - 30; // 复选框在文字左侧
        let checkY = bounds.top + bounds.height() / 2;
        click(checkX, checkY);
        console.log("已勾选[我已阅读并同意]协议复选框");
        randomSleep(500, 800);
    } else {
        console.log("未找到协议复选框，尝试点击协议文字本身");
        let agreeText = textContains("我已阅读").findOne(1000);
        if (agreeText) {
            clickElement(agreeText);
            console.log("已点击协议文字区域");
            randomSleep(500, 800);
        }
    }
}
/**
 * 进入"首页"
 */
function goToHome() {
    console.log("正在进入'首页'页面...");
    let homeBtn = $(OperationType.TEXT, "首页");
    if (homeBtn) {
        clickElement(homeBtn)
        console.log("已点击'首页'按钮");
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
        clickElement(raskCenterBtn);
        console.log("已点击'左上角更多'按钮");
    }
    let centerBtn = $(OperationType.DESC, '任务中心');
    if(centerBtn){
        clickElement(centerBtn);
        console.log('已点击"任务中心"按钮')
        return true
    }
    return false
}
function clickLocation(locatioin, label){
    let x = locatioin.centerX()+getRandomInt(1,3);
    let y = locatioin.centerY()+getRandomInt(1,3);
    click(x, y);
    randomSleep(1000, 1500);
    console.log('已点击', label, '[', x,',', y, ']')
}

/**
 * 智能点击元素：当目标元素 clickable=false 时（如 TextView 文字标签），
 * 自动向上查找可点击的父容器（如 LinearLayout 按钮容器）再点击其坐标。
 * @param {UiObject} element 待点击的 UiObject
 * @return {Boolean} 是否成功点击
 */
function clickElement(element){
    if(!element){
        console.log('clickElement: 元素为空');
        return false;
    }
    let label = element?.text();
    // 向上查找可点击的祖先元素（最多5层）
    try {
        let target = element;
        let depth = 0;
        while(target && !target.clickable() && depth < 5){
            target = target.parent();
            depth++;
        }
        if(target && target.clickable()){
            console.log('元素不可点击，改点击第' + depth + '层父容器');
            clickLocation(target, target?.text());
            return true;
        }
    }catch (e) {
        // 兜底：直接用原元素坐标点击
        console.log('兜底点击')
        clickLocation(element, label);
    }
    return false;
}

/**
 * 兄弟元素
 * @param element
 * @returns {boolean}
 */
function clickElementBro(element, isPrev){
    if(!element){
        console.log('clickElement: 元素为空');
        return false;
    }
    // 向上查找可点击的祖先元素（最多5层）
    try {
        let target = element;
        target = target.parent();
        let parent = target.parent();
        let myIndex = target.indexInParent();  // 获取自己在父节点中的位置
        if(isPrev){
            // 上一个兄弟
            let prevSibling = (myIndex > 0) ? parent.child(myIndex - 1) : null;
            console.log("上一个兄弟的文本:", prevSibling.text());
            if(prevSibling && prevSibling.clickable()){
                prevSibling.click();
            }
        }else{
            // 下一个兄弟
            let nextSibling = (myIndex < parent.childCount() - 1) ? parent.child(myIndex + 1) : null;
            console.log("下一个兄弟的文本:", nextSibling.text());
            if(nextSibling && nextSibling.clickable()){
                nextSibling.click();
            }
        }
    }catch (e) {
    }
    randomSleep(1000, 1500);
    return false;
}

function clickAnyPonit(){
    click(device.width - getRandomInt(50, 100), device.height - getRandomInt(50, 100));
}
/**
 * 进入"我"页面
 */
function goToProfile() {
    console.log("正在进入'我'页面...");
    // 方法1: 通过描述文字查找"我"按钮
    let profileBtn = $(OperationType.BOUNDS_BY_TEXT, '我');
    if(profileBtn){
        clickElement(profileBtn);
        console.log("已点击'我'按钮");
        // 点击"我"后，检测是否进入了登录引导页（未登录状态）
        return true;
    }
    return false;
}

function phoneLogin(){
    let phoneLoginBtn = $(OperationType.TEXT, "手机号登录");
    if (phoneLoginBtn) {
        console.log("检测到登录引导页");
        clickElement(phoneLoginBtn);
    }
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
        "立即签到"
    ];
    for (let btnText of signInBtnTexts) {
        let signBtn = $(OperationType.BOUNDS_BY_TEXT, btnText);
        if (signBtn) {
            clickElement(signBtn);
            console.log("已点击签到按钮：" + btnText);
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
        clickElement(goldenBtn);
        console.log("已点击'点可领'按钮");
        // 6. 关闭弹窗
        closePopups();
        // 需要通过goldenBtn获得倒计时
    }
}

function scheduleTask(timeout, func, execCount){
    func();
    let timer = setInterval(() => {
        execCount--;
        if (execCount <= 0) clearInterval(timer);
        func();
    }, timeout);
}
/**
 * 立即领取 操作
 */
function 立即领取() {
    //无效果
    let btn = $(OperationType.CONTAINS, '立即领取')
    clickElement(btn);
    let 任务完成奖励xx金币 = $(OperationType.CONTAINS, '任务完成奖励');
    if(任务完成奖励xx金币){
        back();
        let 日常任务 = $(OperationType.TEXT, '日常任务');
        if(!日常任务){
            goToHome();
            goToTaskCenter();
        }
    }
}
/**
 * 观看广告 操作 30s
 */
function doWatchAd() {
    let adBtn = $(OperationType.BOUNDS_BY_TEXT, '领福利')
    if(adBtn){
        clickElement(adBtn)
        console.log('点击"领福利"按钮')
        randomSleep(300, 800);
    }
}

function startAdTask(adCount){
    for(let i = 0; i< adCount; i++){
        console.log('当前第'+(i+1)+'个领福利广告')
        doWatchAd()
        sleep(getRandomInt(30000, 31000));
        let giftBtn = $(OperationType.ID, PKG+'.commercial_neo:id/count_down_icon_container')
        if(giftBtn){
            back();
        }else{
            let followBtn = $(OperationType.TEXT, '关注')
            if(followBtn) {
                back();
                let exitLive = $(OperationType.BOUNDS_BY_TEXT, '退出(1500)')
                if(exitLive){
                    clickElement(exitLive)
                }
                return true;
            }else{
               console.log('本次未进入到领福利的广告界面来')
            }
        }
        let closeViewBtn = $(OperationType.DESC, 'close_view(1500)');
        if(closeViewBtn){
            closeViewBtn.click();
        }else{
            console.log('请检查是否在正确的【领福利-广告-奖励界面】')
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
    let searchBtn = $(OperationType.TEXT, '去搜索')
    if(searchBtn){
        clickElement(searchBtn)
        execSearchItem();
    }
}
function execSearchItem() {
    let taskBtn = $(OperationType.CONTAINS, '已完成')
    if(taskBtn){
        let taskText = taskBtn.text()
        let arr = parseText(taskText)
        if(arr){
            let completed = arr[0]
            let total = arr[1]/2
            for(let i = completed; i< total; i++){
                console.log('当前第'+(i+1)+'个 去搜索 奖励 进度：'+ ((i+1) / total * 100)+'%')
                handlerSearchItem()
            }
            taskBtn = $(OperationType.CONTAINS, '已完成')
            if(taskBtn){
                let taskText = taskBtn.text()
                let arr = parseText(taskText)
                if(arr){
                    let completed = arr[0]
                    let total = arr[1]/2
                    if(completed === total){
                        back();
                        let confirmBackBtn = $(OperationType.TEXT, '仍要退出')
                        if(confirmBackBtn){
                            confirmBackBtn.click();
                        }
                    }
                }
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
    let itemBtn = $(OperationType.BOUNDS_BY_TEXT, '搜索')
    if(itemBtn){
        log('点击了任务列表中的 "搜索" 按钮')
        clickElement(itemBtn);
        let realAd = $(OperationType.CONTAINS, '后可领取');
        if(realAd){
            randomSleep(26000, 28000)
            successAward();
            randomSleep(500, 800)
            let closeViewBtn = $(OperationType.DESC, 'close_view');
            clickElement(closeViewBtn);
            continuouRecond = []
        }else{
            // console.log('出现了无奖励任务，重试')
            // back()
            // let changeAdBtn = $(OperationType.BOUNDS_BY_TEXT, '换一个广告')
            // if(changeAdBtn){
            //     clickElement(changeAdBtn);
            //     randomSleep(26000, 28000)
            //     continuouRecond = []
            // }else{
            //     continuouRecond.push(1);
            //     if(continuouRecond.length >= 3){
            //         return false;
            //     }
            //     handlerSearchItem();
            // }
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
let coloseCount = 3;
function closePopups() {
    if(coloseCount<=0){
        console.log('退出关闭弹窗')
        coloseCount = 3;
        let lookAdPopup = $(OperationType.CONTAINS, '去看广告得')
        if(lookAdPopup){
            console.log('无法关闭')
            lookAdPopup.click();
            startAdTask(1)
        }
        return;
    }
    // 查找关闭按钮
    // let closeBtn = $(OperationType.CLASS_NAME,'android.widget.Image',12,0);
    // if(closeBtn){
    //     closeBtn.click();
    //     coloseCount --
    //     console.log("已关闭弹窗"+(3 - coloseCount)+'次');
    //     closePopups();
    // }else{
    //     console.log('没有弹窗出现了，退出关闭逻辑')
    //     coloseCount = 3
    // }
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
    goToProfile();
    // 优先检测：若 goToProfile 已导航到密码登录表单，直接判定为未登录
    let pwdInput = id(PKG+":id/password_et").findOne(800);
    if (pwdInput) {
        console.log("当前处于密码登录表单，判定为未登录");
        return false;
    }
    // 检测是否仍停留在登录引导页（未跳转）
    let phoneLoginBtn = $(OperationType.TEXT, "手机号登录");
    if (phoneLoginBtn) {
        console.log("检测到登录引导页（手机号登录），判定为未登录");
        return false;
    }
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
    agreenProtocol();
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
        let moreBtn = $(OperationType.ID, PKG+":id/more_btn");
        if(moreBtn){
            moreBtn.click()
            console.log("已点击右上角更多按钮!");
            randomSleep(1000, 1500)
        }
        // 查找设置按钮
        let settingsBtn = $(OperationType.ID, PKG+":id/bottom_right");
        if (settingsBtn) {
            settingsBtn.click();
            console.log("已点击设置");
            //滑动到底部
            randomSleep(500,1500)
            switchVideo('up')
            console.log('滑动一次')
            switchVideo('up')
            console.log('滑动两次')
            switchVideo('up')
            console.log('滑动三次')
            // 查找退出登录或切换账号
            let logoutBtn = $(OperationType.TEXT, "退出登录");
            if (logoutBtn) {
                logoutBtn.click();
                console.log("已点击退出登录");
                // 确认退出
                randomSleep(1000, 1200)//此处必须要
                let confirmBtn = $(OperationType.BOUNDS_BY_TEXT, "退出登录");
                if (confirmBtn) {
                    clickElement(confirmBtn)
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
 * 点击密码管理 并输入密码
 * @returns {boolean}
 */
function clickPwdBtn(){
    let pwdInput = $(OperationType.TEXT, '密码登录');
    clickElement(pwdInput);
    console.log("点击密码登录");
    if (pwdInput) {
        setVal(pwdInput, Account['self'].password);
    } else {
        console.log("未找密码登录,尝试一键登录");
        let oneKeyLogin = $(OperationType.TEXT, "一键登录");
        if(oneKeyLogin){
            clickElement(oneKeyLogin)
            handlePopups();
        }else{
            console.log("未找一键登录");
            return false;
        }
    }
    return true;
}

function setVal(node, v){
    let label = node?.text();
    console.log("已输入", label)
    node.setText(v)
    randomSleep(300, 800)
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
        randomSleep(1000, 2000);
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
        clickPwdBtn();
        
        // 点击登录按钮
        let loginBtn = $(OperationType.ID, PKG+":id/confirm_btn");
        if (!loginBtn) {
            loginBtn = $(OperationType.TEXT, "登录");
        }
        if (loginBtn) {
            loginBtn.click();
            console.log("已点击登录按钮");
            // 处理可能的协议同意
            handlePopups();
            // 处理可能的验证码
            let validateBtn = $(OperationType.TEXT, "去验证");
            if (validateBtn) {
                console.log("需要验证码，请手动处理");
                toast("账号 " + account.name + " 需要验证码，请手动处理");
                // 等待用户手动处理验证码
                sleep(60000); // 等待60秒
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
    try {
        // 1. 检查是否需要登录
        if (!isLoggedIn()) {
            console.log("当前未登录，开始登录...");
            goToLogin();
            if (!isLoggedIn()) {
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
        }else{
            //判断是否出现了瓜分百亿金币的弹窗
            let onHundredBtn = $(OperationType.TEXT, '立即参与')
            if(onHundredBtn){
                back();
            }
        }
        // 5. 执行签到
        doSignIn();
        // 6. 点可领
        scheduleTask(1500* 1000, doGetGold, 20);
        // 7. 连续打卡白拿手机
        alwaysCheckIn();
        // 去观看
        loadAd();
        //
        // 8. 领福利
        if(!startAdTask(30)){
            console.log('观看 领福利-广告奖励 出现异常，请检查')
        }
        // 9. 看短剧
        if(!startWatchShortVideo()){
            console.log('观看 看短剧-奖励 出现异常,请检查')
        }
        // 10. 去领取 挑战任务 30天 有可能进入到推金币游戏 (已处理)
        doGoLingQu();
        goToSearch();
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
        
        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i];
            Account['self'] = account;
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
function checkProupAndClose(){
    let closeBtn = className("android.view.ViewGroup").clickable(true).depth(15).findOne(1000);
    if (closeBtn) {
        // 二次校验：确保在屏幕右半边偏上
        console.log('出现 领养xx 关闭按钮');
        clickElement(closeBtn);
    }
    closeBtn = $(OperationType.CLASS_NAME,'android.widget.Image',12,0);
    if(closeBtn){
        // 点击签到出现的连续签到弹窗
        console.log('出现连续签到xx 关闭按钮')
        clickElement(closeBtn)
    }
}

/**
 * 连续打卡白拿手机
 */
function alwaysCheckIn(){
    let btn = $(OperationType.CONTAINS, '连续打卡白拿手机');
    if(btn){
        clickElement(btn)
        btn = $(OperationType.TEXT, '重新选择商品');
        if(btn){
            clickElement(btn)
            // 完成365天打卡任务 白拿好礼
            // 现金1.5元
            let award = $(OperationType.TEXT, sign_day.label);
            if(award){
                console.log(award)
                clickElementBro(award)
                let startTask = $(OperationType.TEXT, '开启挑战');
                if(startTask){
                    clickElement(startTask);
                        clickAnyPonit();
                }
            }else{
                console.log('未找到')
            }

        }
        let signBtn = $(OperationType.TEXT, '去签到');
        if(signBtn){
            clickElement(signBtn);
            randomSleep(1000, 3000);
            let tomorrow = $(OperationType.TEXT, '明天一定来');
            if(tomorrow){
                clickElement(tomorrow);
            }
        }
    }
    let title = $(OperationType.CONTAINS, '完成365天打卡任务');
    if(title){
        back();
    }
}

/**
 * 前3天打卡得金币
 */
function alwaysCheckIn3(){
    let btn = $(OperationType.TEXT_MATCHES, /前\d+天打卡得金币/);
    if(btn){
        clickElement(btn);
        // TODO 点进来后应该点什么
    }
    let text = $(OperationType.CONTAINS, '今日打卡任务')
    if(text){
        back();
    }
}

/**
 * 开盲盒必得金币
 */
function openBindBox(){
    let btn = $(OperationType.CONTAINS, '开盲盒必得金币');
    if(btn){
        clickElement(btn);
        let happyAccept = $(OperationType.TEXT, '开心收下');
        if(happyAccept){
            clickElement(happyAccept);
            let bindBox = $(OperationType.TEXT, '开盲盒');
            if(bindBox){
                clickElement(bindBox);
                let again = $(OperationType.TEXT, '继续开盲盒');
                if(again){
                    clickElement(again)
                    let goto = $(OperationType.TEXT, '去分享');
                    if(goto){
                        back();
                    }
                }
            }
        }
    }
}
/**
 * 到饭点领饭补
 */
function getLunchAward(){
    let btn = $(OperationType.CONTAINS, '到饭点领饭补');
    if(btn){
        clickElement(btn);
        let _btn = $(OperationType.CONTAINS, '待补签');
        while(_btn && _btn.clickable()){
            clickElement(_btn)
            sleep(getRandomInt(30000, 31000));
            let avdText = $(OperationType.TEXT, '广告');
            if(avdText){
                back();
            }
            _btn = $(OperationType.CONTAINS, '待补签');
        }
        console.log('-------')
    }
    let awardGold = $(OperationType.TEXT_MATCHES, /领取饭补\d+金币/);
    if(awardGold){
        clickElement(awardGold);
        let closeBtn = $(OperationType.CLASS_NAME, 'android.widget.TextView');
        if(closeBtn){
            clickElement(closeBtn);
            let closeBtn = $(OperationType.CONTAINS, '看广告最多再得');
            if(closeBtn){
                clickElement(closeBtn);
                randomSleep(getRandomInt(26000, 30000));
                successAward();
                领取奖励();
                const 到点领饭补金币 = $(OperationType.TEXT, '到点领饭补金币');
                if(到点领饭补金币){
                    back();
                }
            }
        }
    }
}

/**
 *
 */
function goToVideo(){
    let btn = $(OperationType.CONTAINS, '看视频赚金币');
    if(btn){
        clickElement(btn)
    }
}
// 红包控件
function isAdPage(){
    let readImage = $(OperationType.TEXT_MATCHES,/\+\d+\s*金币/);
    if(readImage){
        return true;
    }
    return false;
}
function loadAd(){
    let gotowatch = $(OperationType.TEXT, '去观看');
    if(gotowatch) {
        clickElement(gotowatch)
    }
    if(!isAdPage()){
        console.log('没有在广告界面')
        return false;
    }
    sleep(getRandomInt(15000, 17000));
    for(let i = 1; i< Account.watch_video*2; i++){
        console.log('当前第'+i/2+'个广告奖励')
        sleep(getRandomInt(15000, 17000));
        switchVideo('up');
    }
}

function 领取奖励(){
    let btn = $(OperationType.TEXT, '领取奖励');
    if(btn){
        clickElement(btn);
        randomSleep(getRandomInt(26000, 30000));
        successAward();
    }
}

/**
 * 已成功领取xxx金币
 */
function successAward(){
    let allreayGet = $(OperationType.CONTAINS, '已成功领取');
    if(allreayGet){
        back()
    }
}
// main();
// doSignIn();
// checkProupAndClose();
// goToSearch();

// getLunchAward();


