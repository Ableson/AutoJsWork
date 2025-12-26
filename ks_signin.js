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
    CLASS_NAME: 5
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
const unit = 60;

// 控制台显示
console.show();
console.clear();

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
    let agreeBtn = $(OperationType.TEXT, "同意并继续");
    if (agreeBtn) {
        agreeBtn.click();
        console.log("已点击 同意并继续");
        randomSleep(1500, 2000);
    }
    
    // 处理"允许"权限请求
    let allowBtn = $(OperationType.TEXT, "允许");
    if (allowBtn) {
        allowBtn.click();
        console.log("已点击 允许");
        randomSleep(1000, 1500);
    }
    
    // 处理"始终允许"权限请求
    let alwaysAllowBtn = $(OperationType.TEXT, "始终允许");
    if (alwaysAllowBtn) {
        alwaysAllowBtn.click();
        console.log("已点击 始终允许");
        randomSleep(1000, 1500);
    }
    
    // 处理"我知道了"弹窗
    let knowBtn = $(OperationType.TEXT, "我知道了");
    if (knowBtn) {
        knowBtn.click();
        console.log("已点击 我知道了");
        randomSleep(1000, 1500);
    }
}

/**
 * 进入"我"页面
 */
function goToProfile() {
    console.log("正在进入'我'页面...");
    
    // 方法1: 通过描述文字查找"我"按钮
    let profileBtn = $(OperationType.DESC, "我");
    if (profileBtn) {
        profileBtn.click();
        console.log("已点击'我'按钮");
        randomSleep(2000, 3000);
        return true;
    }
    
    // 方法2: 通过文本查找"我"
    profileBtn = $(OperationType.TEXT, "我");
    if (profileBtn) {
        profileBtn.click();
        console.log("已点击'我'文本");
        randomSleep(2000, 3000);
        return true;
    }
    
    // 方法3: 通过坐标点击（底部导航栏通常在第5个位置）
    // 如果前两种方法都失败，可以尝试点击底部导航栏
    console.log("尝试通过坐标点击'我'...");
    let screenWidth = device.width;
    let screenHeight = device.height;
    // 底部导航栏通常在第5个位置（从左到右）
    click(screenWidth * 0.9, screenHeight * 0.95);
    randomSleep(2000, 3000);
    
    return true;
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
            if (bounds.top < device.height * 0.3) {
                packet.click();
                console.log("已点击可能的红包入口");
                randomSleep(2000, 3000);
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
    
    // 等待页面加载
    randomSleep(2000, 3000);
    
    // 查找签到按钮
    const signInBtnTexts = [
        "立即签到",
        "签到",
        "去签到",
        "领取",
        "领取奖励"
    ];
    
    for (let btnText of signInBtnTexts) {
        let signBtn = $(OperationType.TEXT, btnText);
        if (signBtn && signBtn.clickable()) {
            signBtn.click();
            console.log("已点击签到按钮：" + btnText);
            randomSleep(2000, 3000);
            
            // 检查是否有签到成功的提示
            checkSignInResult();
            return true;
        }
        
        // 尝试通过包含文本查找
        signBtn = $(OperationType.CONTAINS, btnText);
        if (signBtn && signBtn.clickable()) {
            signBtn.click();
            console.log("已点击签到按钮（包含）：" + btnText);
            randomSleep(2000, 3000);
            checkSignInResult();
            return true;
        }
    }
    
    // 尝试查找可点击的图片或按钮
    let clickableBtns = $(OperationType.CLASS_NAME, "android.widget.Button", undefined, undefined, false);
    if (clickableBtns && clickableBtns.size() > 0) {
        for (let i = 0; i < clickableBtns.size(); i++) {
            let btn = clickableBtns.get(i);
            let btnText = btn.text();
            if (btnText && (btnText.includes("签到") || btnText.includes("领取"))) {
                btn.click();
                console.log("已点击按钮：" + btnText);
                randomSleep(2000, 3000);
                checkSignInResult();
                return true;
            }
        }
    }
    
    console.log("未找到签到按钮，可能已经签到过了");
    return false;
}

/**
 * 检查签到结果
 */
function checkSignInResult() {
    console.log("检查签到结果...");
    randomSleep(2000, 3000);
    
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
    const closeBtnKeywords = [
        { type: OperationType.TEXT, keyword: "关闭" },
        { type: OperationType.TEXT, keyword: "×" },
        { type: OperationType.TEXT, keyword: "知道了" },
        { type: OperationType.DESC, keyword: "关闭" }
    ];
    
    for (let btnConfig of closeBtnKeywords) {
        let btn = $(btnConfig.type, btnConfig.keyword);
        if (btn) {
            btn.click();
            console.log("已关闭弹窗");
            randomSleep(1000, 1500);
            break; // 找到一个就退出
        }
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
    // 检查是否存在"登录"或"立即登录"按钮
    let loginBtn = $(OperationType.TEXT, "登录");
    if (loginBtn) {
        return false;
    }
    
    loginBtn = $(OperationType.TEXT, "立即登录");
    if (loginBtn) {
        return false;
    }
    
    // 检查是否存在"我"页面（已登录状态）
    let profileBtn = $(OperationType.DESC, "我");
    if (profileBtn) {
        return true;
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
        randomSleep(2000, 3000);
        
        // 查找设置按钮
        let settingsBtn = $(OperationType.TEXT, "设置");
        if (!settingsBtn) {
            settingsBtn = $(OperationType.DESC, "设置");
        }
        
        if (settingsBtn) {
            settingsBtn.click();
            console.log("已点击设置");
            randomSleep(2000, 3000);
            
            // 查找退出登录或切换账号
            let logoutBtn = $(OperationType.TEXT, "退出登录");
            if (!logoutBtn) {
                logoutBtn = $(OperationType.CONTAINS, "退出");
            }
            if (!logoutBtn) {
                logoutBtn = $(OperationType.TEXT, "切换账号");
            }
            
            if (logoutBtn) {
                logoutBtn.click();
                console.log("已点击退出登录");
                randomSleep(2000, 3000);
                
                // 确认退出
                let confirmBtn = $(OperationType.TEXT, "确定");
                if (!confirmBtn) {
                    confirmBtn = $(OperationType.TEXT, "退出");
                }
                if (confirmBtn) {
                    confirmBtn.click();
                    console.log("已确认退出");
                    randomSleep(3000, 4000);
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
        click(device.width * 0.88, device.height * 0.25);
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
            phoneInput = $(OperationType.ID, "com.smile.gifmaker:id/phone_et");
        }
        if (!phoneInput) {
            phoneInput = $(OperationType.CLASS_NAME, "android.widget.EditText", undefined, undefined, true);
        }
        
        if (phoneInput) {
            phoneInput.setText(account.phone);
            console.log("已输入手机号");
            randomSleep(1000, 1500);
        } else {
            console.log("未找到手机号输入框");
            return false;
        }
        
        // 切换到密码登录
        let pwdLoginBtn = $(OperationType.TEXT, "密码登录");
        if (pwdLoginBtn) {
            pwdLoginBtn.click();
            console.log("已切换到密码登录");
            randomSleep(1500, 2000);
        }
        
        // 输入密码
        let pwdInput = $(OperationType.ID, "com.smile.gifmaker:id/password_et");
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
            randomSleep(1000, 1500);
        } else {
            console.log("未找到密码输入框");
            return false;
        }
        
        // 点击登录按钮
        let loginBtn = $(OperationType.ID, "com.smile.gifmaker:id/confirm_btn");
        if (!loginBtn) {
            loginBtn = $(OperationType.TEXT, "登录");
        }
        if (!loginBtn) {
            loginBtn = $(OperationType.TEXT, "同意并登录");
        }
        
        if (loginBtn) {
            loginBtn.click();
            console.log("已点击登录按钮");
            randomSleep(3000, 4000);
            
            // 处理可能的协议同意
            let agreeBtn = $(OperationType.TEXT, "同意并登录");
            if (agreeBtn) {
                agreeBtn.click();
                console.log("已同意协议");
                randomSleep(2000, 3000);
            }
            
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
    
    try {
        // 1. 检查是否需要登录
        if (!isLoggedIn()) {
            console.log("当前未登录，开始登录...");
            if (!login(account)) {
                console.log("登录失败，跳过该账号");
                return false;
            }
        } else {
            console.log("当前已登录，检查是否需要切换账号...");
            // 可以添加检查当前登录账号的逻辑
            // 如果账号不匹配，先退出再登录
        }
        
        // 2. 处理弹窗
        handlePopups();
        
        // 3. 进入"我"页面
        if (!goToProfile()) {
            console.log("进入'我'页面失败");
            return false;
        }
        
        // 再次处理可能的弹窗
        handlePopups();
        
        // 4. 查找签到入口
        if (!findSignInEntry()) {
            console.log("未找到签到入口，尝试直接查找签到按钮");
        }
        
        // 5. 执行签到
        doSignIn();
        
        // 6. 关闭弹窗
        closePopups();
        
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
        
        // 3. 处理初始弹窗
        handlePopups();
        
        // 4. 循环处理每个账号
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i];
            console.log("\n>>> 处理第 " + (i + 1) + "/" + accounts.length + " 个账号");
            
            // 如果不是第一个账号，需要先退出当前账号
            if (i > 0) {
                console.log("切换账号，先退出当前账号...");
                logout();
                randomSleep(2000, 3000);
                
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

