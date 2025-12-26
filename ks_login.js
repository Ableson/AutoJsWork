/**
 * 操作类型枚举
 */
const OperationType = Object.freeze({
    DESC: 1,
    TEXT: 2,
    CONTAINS: 3,
    ID: 4,
    CLASS_NAME: 5
});

// 重试时间(分钟)
const retry_time = 1;
// 单位/进制
const unit = 60;

/**
 * 自动超时查找元素
 * @param {操作类型} type 
 * @param {关键字} keyWord 
 * @returns 
 */
function $(type, keyWord, nth, idx){
    let ele = undefined;
    let findCount = 0;
    while(true){
        switch(type){
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
                ele = className(keyWord);
                if(nth){
                    ele = ele.depth(nth);
                }
                if(idx){
                    ele = ele.indexInParent(idx);
                }
                ele = ele.find();
                break;
            default:
                console.log('操作类型不存在：'+ type);
                return;
        }
        if(ele){
            return ele;
        }else{
            findCount ++;
            if(findCount >= retry_time * unit){
                toast("在"+retry_time+"分钟内未查找到该内容【"+ keyWord +"】的元素");
                return;
            }else{
                console.log('正在重试获取,获取次数:', findCount);
            }
        }
    }
}

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
        endX: screenWidth * 0.5,
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
        sleep(getRandomInt(1500, 3000));// 动态随机数
        return true;
    } catch (e) {
        // toast("滑动失败：" + e.message);
        console.log(e.message)
        return false;
    }
}

/**
 * 生成指定范围的随机整数（包含 min 和 max）
 * @param {Number} min 最小值
 * @param {Number} max 最大值
 * @return {Number} 随机整数
 */
function getRandomInt(min, max) {
    // 兼容 min > max 的情况，自动交换
    if (min > max) {
        [min, max] = [max, min]; // 4.1.1 支持数组解构，放心使用
    }
    // 核心公式：Math.floor 向下取整，确保结果是整数
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// "ui";
auto.waitFor();           // 等待无障碍授权
auto.setMode("normal");   // 兼容模式，4.x 专用

// 快手包名
const PKG = "com.smile.gifmaker";
// const PKG = "com.kuaishou.nebula";

const phone = '13982227224'
const pwd  = 'tgx123456.'
threads.start(function () {
    // 1. 打开快手
    // app.launchPackage(PKG);
    // 2. 点击“我”
    // let ele = $(OperationType.DESC, '我');
    // if (ele) ele.click();

    // let home = $(OperationType.DESC, '首页');
    // if( home ) home.click();
    // 3. 回到登录界面，尝试输入手机号
    // let phone_ele = $(OperationType.TEXT, '请输入手机号');
    // if (phone_ele) phone_ele.setText(phone);
    // 4. 密码登录
    // let pwd_login_btn = $(OperationType.TEXT, '密码登录');
    // if (pwd_login_btn) pwd_login_btn.click();
    // 5. 输入密码
    // let pwd_input = $(OperationType.ID, 'com.smile.gifmaker:id/password_et');
    // if(pwd_input) pwd_input.setText(pwd);
    // 6. 点击登录
    // let login_btn = $(OperationType.ID, 'com.smile.gifmaker:id/confirm_btn');
    // if (login_btn) login_btn.click();
    // 7. 同意协议
    // let protocol_btn = $(OperationType.TEXT, '同意并登录');
    // if(protocol_btn) protocol_btn.click();
    // 8. 去验证
    // let validate_btn = $(OperationType.TEXT, '去验证');
    // if(validate_btn) validate_btn.click();
    // 9. 可能出现加载失败，尝试 点击重试
    // let retry_btn = $(OperationType.TEXT, '重试');
    // if(retry_btn) {
    //     retry_btn.click();
    //     //点击重试过后；
    //     retry_btn = $(OperationType.TEXT, '重试');
    //     if(retry_btn) {
    //         //依然失败， 那就取消通过验证码登录
    //         let cancle_btn = $(OperationType.TEXT, '取消');
    //         if(cancle_btn) cancle_btn.click();
    //         let validate_btn = $(OperationType.TEXT, '验证码登录');
    //         if(validate_btn) validate_btn.click();
    //     }
    //     //走 验证码登录
    //     let getSmsCode = $(OperationType.TEXT, '获取验证码');
    //     if(getSmsCode) getSmsCode.click();
    //     let smsCode = dialogs.rawInput("请输入收到的验证码", "");
    //     let validate_input = $(OperationType.ID, 'com.smile.gifmaker:id/captcha_code_et');
    //     if(validate_input) validate_input.setText(smsCode);
    //     let goto_validate = $(OperationType.TEXT, '去验证');
    //     if(goto_validate) goto_validate.click();
    // }
    // switchVideo('up')
    // let swipeCount = 30;
    // for(let i = 0; i< swipeCount; i++){
    //     switchVideo('up');
    //     sleep(getRandomInt(30000, 33000));
    //     console.log('当前第'+i+1+'个视频')
    // }

    // signed();
    let gotoVideo = $(OperationType.TEXT, '去看视频');
    if(gotoVideo) gotoVideo.click();

    switchVideo('up')
    let swipeCount = 30;
    for(let i = 0; i< swipeCount; i++){
        switchVideo('up');
        sleep(getRandomInt(15000, 20000));
        console.log('当前第'+(i+1)+'个视频')
    }
});


function signed(){
    // let home = $(OperationType.DESC, '首页')
    // if(home) home.click();
    // 点击红包
    // clickRed();
    
    // let signBtn = $(OperationType.TEXT,'立即签到');
    // if(signBtn) signBtn.click();
    
    
    // let goldenBtn = $(OperationType.CONTAINS, '点可领');
    // if(goldenBtn) goldenBtn.click();
    // let eles = $(OperationType.CLASS_NAME,'android.widget.Image',12,0);
    // console.log(eles.size());
    // if(eles && eles.size() > 0 ){
    //     eles.get(eles.size() - 1).click();
    // }
}




/**
 * 点击红包
 */
function clickRed(){
    let eles = className('android.view.ViewGroup').depth(5).indexInParent(0).find();
    if(eles && eles.size() > 0){
        let ele = eles.get(0);
        let location = ele.bounds();
        click(location.centerX()+getRandomInt(1,3), location.centerY()+getRandomInt(1,3));
    }
}
/**
 * 等待并点击“同意并继续”
 * 最多 8 秒，超时视为无弹窗
 */
function agreeIfExist() {
    let agree = text("同意并继续").findOne(8000);
    if (agree && agree.clickable()) {
        agree.click();
        toast("已点击 同意并继续");
        sleep(1500);          // 留给界面动画
    } else {
        log("未出现同意弹窗，继续");
    }
}

function closeApp(){
    try{
        // 打开快手应用信息页
        app.openAppSetting("com.smile.gifmaker");
        sleep(800);   // 等待页面加载

        // 模拟点击“强制停止”按钮（通用坐标）
        click(device.width * 0.88, device.height * 0.25);   // 右上角停止区域
        let stopBtn = text('强行停止').findOne(3000);
        if(stopBtn) stopBtn.click();
        sleep(300);
        back();   // 返回桌面
    }catch(e){
        back();
        back();
    }
    toast("快手已退出");
}