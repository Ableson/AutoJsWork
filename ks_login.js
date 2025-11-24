// "ui";
auto.waitFor();           // 等待无障碍授权
auto.setMode("normal");   // 兼容模式，4.x 专用

// 快手包名
const PKG = "com.kuaishou.nebula";

// 简单 UI 方便手动填账号
// ui.layout(
//     <vertical padding="16">
//         <text textSize="16sp" text="快手一键登录 Demo"/>
//         <text textSize="14sp" text="手机号："/>
//         <input id="phone" hint="11 位手机号" inputType="phone"/>
//         <text textSize="14sp" text="密码："/>
//         <input id="pwd" hint="6-20 位密码" inputType="textPassword"/>
//         <button id="start" text="开始登录"/>
//     </vertical>
// );

// ui.start.on("click", function () {
//     let phone = ui.phone.text();
//     let pwd = ui.pwd.text();
//     if (!/^1[3-9]\d{9}$/.test(phone)) {
//         toast("手机号格式错误");
//         return;
//     }
    
// });
const phone = '13982227224'
const pwd  = 'tgx123456.'
threads.start(function () {
    closeApp();
    sleep(3000);
    kuaishouLogin(phone, pwd);
});

function kuaishouLogin(phone, pwd) {
    // 1. 打开快手
    app.launchPackage(PKG);
    sleep(3000);

    /* 新增：监测同意按钮 */
    agreeIfExist();
    // 2. 点右下角“我的”
    let mine = desc("我的").findOne(8000);
    if (mine) {
        mine.click(); 
    }else {
        console.error("找不到 我的");
        mine = desc('我').findOne(8000)
        if (mine) mine.click(); else throw "找不到‘我的’也找不到‘我’"
    }
    sleep(1500);

    // 3. 点“登录”按钮
    let loginBtn = text("登 录").findOne(3000);
    if (loginBtn) loginBtn.click(); else console.log("找不到登录按钮");
    loginBtn = textContains('其他登录').findOne(3000)
    if (loginBtn) loginBtn.click(); else throw "找不到含有其他登录的按钮"
    sleep(1500);
    
    // 4. 选择“密码登录”（默认是短信，要点一次切换）
    let pwdTab = text("密码登录").findOne(3000);
    if (pwdTab) pwdTab.click(); else throw "找不到密码登录";
    sleep(1000);

    // 5. 输入手机号
    let phoneInput = id("com.smile.gifmaker:id/phone_input").findOne(3000);
    if (phoneInput) {
        phoneInput.setText(phone);
    } else {
        // 兼容旧版无 id，用控件特征
        phoneInput = text('请输入手机号').findOne(1500);
        if (phoneInput) phoneInput.setText(phone);
    }

    // 6. 输入密码
    let pwdInput = id("com.smile.gifmaker:id/password_input").findOne(1000);
    if (pwdInput) {
        pwdInput.setText(pwd);
    } else {
        pwdInput = className("EditText").find()[1];
        if (pwdInput) pwdInput.setText(pwd);
    }
    back();
    // 7. 点“登录”按钮
    let loginOk = id('com.kuaishou.nebula:id/confirm_btn').findOne(3000);
    if (loginOk) loginOk.click(); else throw "找不到确认登录";
    sleep(3000);
    let loginAgree = id('com.kuaishou.nebula:id/protocol_dialog_positive').findOne(3000);
    if(loginAgree){
        loginAgree.click();
    }
    let goValidate = text('去验证').findOne(2000);
    if(goValidate) {
        goValidate.click();
        let codeBtn = text('获取验证码').findOne(3000);
        if(codeBtn) {
            codeBtn.click();
            sleep(2000);
            let smsCode = dialogs.rawInput("请输入收到的验证码", "");
            if (!smsCode) {
                toast("用户取消，脚本结束");
                exit();
            }
            // 3. 继续填写验证码
            sleep(1000);
            let codeInput = className("EditText").find()[1];
            if (codeInput) codeInput.setText(smsCode); else console.log('未找到验证码输入框')
            // 4. 继续后续流程
            toast("验证码已填写：" + smsCode);
            let validateBtn = text('验证').findOne(1000);
            if (validateBtn) validateBtn.click();
        } else {
            console.log('未找到获取验证码按钮');
        }
    } else {
        console.log('无需验证步骤')
    }
    // 8. 成功判断（出现“首页”或“关注”即可）
    let home = text("首页").findOne(8000) || desc("首页").findOne(8000);
    if (home) {
        toast("快手登录成功！");
    } else {
        toast("登录失败，请检查账号/网络");
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