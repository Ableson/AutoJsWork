/**
 * 快手自动签到脚本（重构优化版 v2）
 * 支持：Accessibility 查找 + OpenCV 图像识别 + 跨设备分辨率自适应 + 定时轮询
 * 适配：Auto.js 6 / AutoX.js
 */

"auto";

// ==================== 1. 配置层 ====================
const Config = Object.freeze({
    PKG: "com.smile.gifmaker",
    ACCOUNTS_FILE: "accounts.json",
    // 制作模板图时的基准分辨率（你截图用的那台手机）
    BASE_WIDTH: 1080,
    BASE_HEIGHT: 2400,
    // 默认重试：0.06分钟 = 3.6秒
    RETRY_TIME: 0.06,
    UNIT: 60,
    // 找图默认参数
    IMAGE_THRESHOLD: 0.85,
    IMAGE_MAX_RETRY: 5,
    IMAGE_RETRY_INTERVAL: 1000,
    // 业务参数
    WATCH_VIDEO_COUNT: 30,
    SIGN_DAY_LABEL: "现金1.5元",
    SIGN_DAY_VAL: 7,
    LIVE_COUNT: 6,
    // 点可领轮询：每 25 分钟(1500秒)执行一次，共 20 次
    GOLD_INTERVAL: 1500 * 1000,
    GOLD_COUNT: 20,
});

// ==================== 2. 查找类型枚举 ====================
const FindType = Object.freeze({
    DESC: 1,
    TEXT: 2,
    CONTAINS: 3,
    ID: 4,
    CLASS_NAME: 5,
    BOUNDS_BY_TEXT: 6,
    TEXT_MATCHES: 7,
    IMAGE: 8,      // 新增：图片模板匹配（OpenCV）
    COLOR: 9,      // 新增：找色兜底
    RATIO: 10,     // 新增：比例坐标兜底
});

// ==================== 3. 工具层 ====================
const Utils = {
    getRandomInt: function(min, max) {
        if (min > max) [min, max] = [max, min];
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    randomSleep: function(min, max) {
        sleep(Utils.getRandomInt(min, max));
    },

    parseKeyword: function(keyWord) {
        let reg = /^([^()]+)(?:\((\d+)\))?$/;
        let match = (typeof keyWord === 'string') ? keyWord.match(reg) : ['', keyWord];
        let result = { prefix: undefined, num: Config.RETRY_TIME * Config.UNIT };
        if (match) {
            result.prefix = (typeof keyWord === 'string') ? match[1].trim() : match[1];
            result.num = match[2] ? parseInt(match[2].trim()) / 1000 : Config.RETRY_TIME * Config.UNIT;
        }
        return result;
    },

    parseFraction: function(str) {
        let nums = str.match(/\d+/g);
        if (nums && nums.length >= 2) {
            return [Number(nums[0]), Number(nums[1])];
        }
        return null;
    },

    // 比例坐标 → 绝对坐标
    ratioToAbs: function(ratioX, ratioY) {
        return {
            x: Math.floor(device.width * ratioX),
            y: Math.floor(device.height * ratioY)
        };
    },

    // 绝对坐标 → 比例坐标（制作模板时用来记录区域）
    absToRatio: function(x, y) {
        return {
            rx: x / Config.BASE_WIDTH,
            ry: y / Config.BASE_HEIGHT
        };
    },

    clickPoint: function(x, y, label) {
        let rx = x + Utils.getRandomInt(1, 3);
        let ry = y + Utils.getRandomInt(1, 3);
        click(rx, ry);
        Utils.randomSleep(800, 1500);
        console.log("已点击", label || "", "[", rx, ",", ry, "]");
    },

    clickBounds: function(element, label) {
        if (!element) return false;
        let b = element.bounds();
        Utils.clickPoint(b.centerX(), b.centerY(), label || element.text());
        return true;
    },

    // 智能向上查找可点击父元素
    clickElement: function(element) {
        if (!element) {
            console.log("clickElement: 元素为空");
            return false;
        }
        let label = element.text ? element.text() : "";
        try {
            let target = element;
            let depth = 0;
            while (target && !target.clickable() && depth < 5) {
                target = target.parent();
                depth++;
            }
            if (target && target.clickable()) {
                console.log("元素不可点击，改点击第" + depth + "层父容器");
                Utils.clickBounds(target, target.text ? target.text() : label);
                return true;
            }
        } catch (e) {
            // 兜底
        }
        Utils.clickBounds(element, label);
        return true;
    },

    // 点击兄弟元素
    clickSibling: function(element, isPrev) {
        if (!element) return false;
        try {
            let target = element.parent();
            let parent = target.parent();
            let myIndex = target.indexInParent();
            let sibling = isPrev
                ? (myIndex > 0 ? parent.child(myIndex - 1) : null)
                : (myIndex < parent.childCount() - 1 ? parent.child(myIndex + 1) : null);
            if (sibling && sibling.clickable()) {
                sibling.click();
                Utils.randomSleep(1000, 1500);
                return true;
            }
        } catch (e) {}
        return false;
    },

    // 滑动配置（按当前设备比例自动计算）
    getSlideConfig: function() {
        let sw = device.width, sh = device.height;
        return {
            LEFT_TO_RIGHT: {
                startX: sw * 0.2, startY: sh * 0.5,
                endX: sw * 0.8, endY: sh * 0.5,
                duration: Utils.getRandomInt(400, 600)
            },
            RIGHT_TO_LEFT: {
                startX: sw * 0.8, startY: sh * 0.5,
                endX: sw * 0.2, endY: sh * 0.5,
                duration: Utils.getRandomInt(400, 600)
            },
            TOP_TO_BOTTOM: {
                startX: sw * 0.5, startY: sh * 0.2,
                endX: sw * 0.5, endY: sh * 0.8,
                duration: Utils.getRandomInt(400, 600)
            },
            BOTTOM_TO_TOP: {
                startX: sw * 0.5, startY: sh * 0.8,
                endX: sw * 0.6, endY: sh * 0.1,
                duration: Utils.getRandomInt(400, 600)
            }
        };
    },

    switchVideo: function(direction) {
        let cfg = Utils.getSlideConfig();
        let c;
        switch (direction.toLowerCase()) {
            case "left": c = cfg.RIGHT_TO_LEFT; break;
            case "right": c = cfg.LEFT_TO_RIGHT; break;
            case "up": c = cfg.BOTTOM_TO_TOP; break;
            case "down": c = cfg.TOP_TO_BOTTOM; break;
            default: return false;
        }
        swipe(
            c.startX + Utils.getRandomInt(1, 10),
            c.startY + Utils.getRandomInt(1, 10),
            c.endX + Utils.getRandomInt(1, 10),
            c.endY + Utils.getRandomInt(1, 10),
            c.duration
        );
        Utils.randomSleep(1000, 2000);
        return true;
    },

    clickAnyPoint: function() {
        click(device.width - Utils.getRandomInt(50, 100), device.height - Utils.getRandomInt(50, 100));
    },

    /**
     * 定时轮询任务
     * @param {number} timeout - 每次轮询间隔（毫秒）
     * @param {Function} func - 要执行的函数
     * @param {number} execCount - 执行次数（包含首次立即执行）
     * @returns {number} timerId，可用 clearInterval 取消
     */
    scheduleTask: function(timeout, func, execCount) {
        console.log("启动定时轮询，间隔 " + (timeout / 1000) + " 秒，共 " + execCount + " 次");
        let count = 0;
        // 首次立即执行
        try { func(); } catch (e) { console.log("scheduleTask 首次执行异常: " + e.message); }
        count++;
        if (count >= execCount) {
            console.log("scheduleTask 单次执行完毕");
            return null;
        }
        // 后续定时执行
        let timer = setInterval(() => {
            try {
                func();
            } catch (e) {
                console.log("scheduleTask 执行异常: " + e.message);
            }
            count++;
            if (count >= execCount) {
                clearInterval(timer);
                console.log("scheduleTask 轮询结束，共执行 " + count + " 次");
            }
        }, timeout);
        return timer;
    }
};

// ==================== 4. 视觉引擎层（核心） ====================
const VisionEngine = (function() {
    let _initialized = false;
    let _baseScale = 1.0;

    // 内部：请求截图权限
    function _ensureCapture() {
        if (!_initialized) {
            if (!requestScreenCapture()) {
                toast("截图权限被拒绝，图像识别功能不可用");
                throw new Error("No screen capture permission");
            }
            sleep(800);
            _initialized = true;
            // 计算基准缩放比例
            _baseScale = Math.sqrt(
                Math.pow(device.width / Config.BASE_WIDTH, 2) +
                Math.pow(device.height / Config.BASE_HEIGHT, 2)
            ) / Math.sqrt(2);
            // 更简单的等比缩放：取宽高的平均比例
            _baseScale = (device.width / Config.BASE_WIDTH + device.height / Config.BASE_HEIGHT) / 2;
            console.log("VisionEngine 初始化完成，基准缩放比例: " + _baseScale.toFixed(4));
        }
    }

    // 内部：基于 Accessibility 查找
    function _findBySelector(type, keyword, options) {
        let nth = options.nth, idx = options.idx, findOne = options.findOne;
        let shouldFindOne = findOne !== undefined ? findOne : (type !== FindType.CLASS_NAME);
        let ele;

        switch (type) {
            case FindType.DESC:
                ele = desc(keyword).findOne(1000);
                break;
            case FindType.TEXT:
                ele = text(keyword).findOne(1000);
                break;
            case FindType.CONTAINS:
                ele = textContains(keyword).findOne(1000);
                break;
            case FindType.ID:
                ele = id(keyword).findOne(1000);
                break;
            case FindType.TEXT_MATCHES:
                ele = textMatches(keyword).findOne(1000);
                break;
            case FindType.CLASS_NAME:
                sleep(500);
                let sel = className(keyword);
                if (nth !== undefined) sel = sel.depth(nth).clickable(true);
                if (idx !== undefined) sel = sel.indexInParent(idx);
                ele = shouldFindOne ? sel.findOne(1000) : sel.find();
                break;
            case FindType.BOUNDS_BY_TEXT:
                ele = text(keyword).findOne(1000);
                if (ele) ele = ele.bounds();
                break;
            default:
                console.log("未知选择器类型: " + type);
                return null;
        }

        // 校验结果
        if (!ele) return null;
        if (type === FindType.CLASS_NAME && !shouldFindOne) {
            return ele.size() > 0 ? ele : null;
        }
        return ele;
    }

    // 内部：基于图片模板查找（OpenCV）
    function _findByImage(templatePath, options) {
        _ensureCapture();
        let threshold = options.threshold || Config.IMAGE_THRESHOLD;
        let autoScale = options.autoScale !== false;
        let region = options.region; // [x, y, w, h] 基于基准分辨率
        let scaleFactors = options.scaleFactors; // 自定义多尺度，如 [0.8, 0.9, 1, 1.1, 1.2]
        let offset = options.offset || [0, 0];

        let template = images.read(templatePath);
        if (!template) {
            console.error("读取模板失败: " + templatePath);
            return null;
        }

        let screen = captureScreen();
        if (!screen) {
            template.recycle();
            return null;
        }

        let result = null;

        // 如果指定了区域，先裁剪
        let searchImg = screen;
        let regionOffsetX = 0, regionOffsetY = 0;
        if (region && region.length === 4) {
            let rx = Math.floor(region[0] * _baseScale);
            let ry = Math.floor(region[1] * _baseScale);
            let rw = Math.floor(region[2] * _baseScale);
            let rh = Math.floor(region[3] * _baseScale);
            // 边界保护
            rx = Math.max(0, rx); ry = Math.max(0, ry);
            rw = Math.min(rw, screen.getWidth() - rx);
            rh = Math.min(rh, screen.getHeight() - ry);
            if (rw > 0 && rh > 0) {
                searchImg = images.clip(screen, rx, ry, rw, rh);
                regionOffsetX = rx;
                regionOffsetY = ry;
            }
        }

        // 确定要尝试的缩放比例列表
        let scales = [1.0];
        if (autoScale) {
            if (scaleFactors && Array.isArray(scaleFactors)) {
                scales = scaleFactors;
            } else {
                // 默认尝试基准比例及附近几个比例
                scales = [0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15].map(s => s * _baseScale);
            }
        }

        for (let scale of scales) {
            let scaledTemplate;
            if (Math.abs(scale - 1.0) > 0.001) {
                scaledTemplate = images.scale(template, scale, scale);
            } else {
                scaledTemplate = template;
            }

            let point = images.findImage(searchImg, scaledTemplate, { threshold: threshold });
            if (point) {
                // 计算中心点 + 区域偏移 + 用户偏移
                let cx = point.x + scaledTemplate.getWidth() / 2 + regionOffsetX + offset[0];
                let cy = point.y + scaledTemplate.getHeight() / 2 + regionOffsetY + offset[1];
                result = { x: cx, y: cy, scale: scale, found: true };
                if (scaledTemplate !== template) scaledTemplate.recycle();
                break;
            }
            if (scaledTemplate !== template) scaledTemplate.recycle();
        }

        if (searchImg !== screen) searchImg.recycle();
        screen.recycle();
        template.recycle();
        return result;
    }

    // 内部：基于比例坐标
    function _findByRatio(ratioX, ratioY) {
        let p = Utils.ratioToAbs(ratioX, ratioY);
        return { x: p.x, y: p.y, found: true, isRatio: true };
    }

    // 公共：统一查找入口（替代原来的 $ 函数）
    function find(type, keyword, options) {
        options = options || {};
        let maxRetry = options.maxRetry;
        let retryInterval = options.retryInterval || 1000;

        // 解析 keyword 中的重试次数（如 "确定(3000)"）
        let parsed = Utils.parseKeyword(keyword);
        let searchKey = parsed.prefix;
        let retryCount = (typeof maxRetry === 'number') ? maxRetry : parsed.num;

        for (let i = 0; i < retryCount; i++) {
            let result = null;

            if (type === FindType.IMAGE) {
                // keyword 是图片路径
                result = _findByImage(searchKey, options);
            } else if (type === FindType.RATIO) {
                // keyword 是 "0.5,0.8" 这样的比例字符串
                let parts = searchKey.split(",").map(Number);
                if (parts.length >= 2) {
                    result = _findByRatio(parts[0], parts[1]);
                }
            } else {
                result = _findBySelector(type, searchKey, options);
            }

            if (result && (result.found || result !== null)) {
                return result;
            }

            if (i < retryCount - 1) {
                console.log("[" + (i + 1) + "/" + retryCount + "] 未找到，重试中...");
                sleep(retryInterval);
            }
        }

        console.log("在 " + retryCount + " 次尝试内未找到目标");
        return null;
    }

    // 公共：查找并点击
    function findAndClick(type, keyword, options) {
        options = options || {};
        let res = find(type, keyword, options);
        if (!res) return false;

        if (type === FindType.IMAGE || type === FindType.RATIO) {
            Utils.clickPoint(res.x, res.y, keyword);
            return true;
        } else if (type === FindType.BOUNDS_BY_TEXT) {
            // BOUNDS_BY_TEXT 返回的是 Rect 对象
            Utils.clickPoint(res.centerX(), res.centerY(), keyword);
            return true;
        } else {
            return Utils.clickElement(res);
        }
    }

    // 公共：智能点击（先找图/控件，失败则比例兜底）
    function smartClick(primaryType, keyword, ratioX, ratioY, options) {
        if (findAndClick(primaryType, keyword, options)) return true;
        console.log("⚠️ 主查找失败，启用比例兜底 (" + ratioX + ", " + ratioY + ")");
        let p = Utils.ratioToAbs(ratioX, ratioY);
        Utils.clickPoint(p.x, p.y, "比例兜底");
        return true;
    }

    // 公共：等待元素出现
    function waitFor(type, keyword, options) {
        options = options || {};
        let timeout = options.timeout || 10000;
        options.maxRetry = Math.ceil(timeout / (options.retryInterval || 1000));
        return find(type, keyword, options) !== null;
    }

    // 公共：截图并裁剪保存为模板（辅助工具）
    function captureTemplate(savePath, x, y, w, h) {
        _ensureCapture();
        let screen = captureScreen();
        let clip = images.clip(screen, x, y, w, h);
        images.save(clip, savePath);
        console.log("模板已保存: " + savePath);
        clip.recycle();
        screen.recycle();
    }

    return {
        init: function() { _ensureCapture(); },
        find: find,
        findAndClick: findAndClick,
        smartClick: smartClick,
        waitFor: waitFor,
        captureTemplate: captureTemplate,
        getScale: function() { return _baseScale; }
    };
})();

// ==================== 5. 快手业务层 ====================
const KuaishouApp = {
    open: function() {
        console.log("正在打开快手...");
        app.launchPackage(Config.PKG);
        Utils.randomSleep(1500, 2500);

        // 处理权限弹窗
        let dialog = VisionEngine.find(FindType.CONTAINS, "想要打开");
        if (dialog) {
            VisionEngine.findAndClick(FindType.TEXT, "始终允许");
        }
        // 处理协议弹窗
        VisionEngine.findAndClick(FindType.TEXT, "同意并继续");

        // 等待首页加载
        if (VisionEngine.waitFor(FindType.TEXT, "我", { timeout: 8000 })) {
            console.log("快手已打开");
            return true;
        }
        console.log("快手启动超时");
        return false;
    },

    close: function() {
        try {
            app.openAppSetting(Config.PKG);
            sleep(800);
            let stopBtn = VisionEngine.find(FindType.TEXT, "强行停止", { maxRetry: 3 });
            if (stopBtn) {
                stopBtn.click();
                sleep(300);
            }
            back();
            console.log("快手已强制停止");
        } catch (e) {
            back(); back();
        }
    },

    isLoggedIn: function() {
        // 先尝试进入"我"页面
        if (!VisionEngine.find(FindType.TEXT, "我", { maxRetry: 2 })) {
            VisionEngine.findAndClick(FindType.BOUNDS_BY_TEXT, "我");
        }
        // 检测密码输入框（未登录标志）
        if (id(Config.PKG + ":id/password_et").findOne(800)) {
            return false;
        }
        // 检测手机号登录按钮
        if (VisionEngine.find(FindType.TEXT, "手机号登录", { maxRetry: 1 })) {
            return false;
        }
        // 检测用户名（已登录标志）
        if (VisionEngine.find(FindType.ID, Config.PKG + ":id/user_name_tv", { maxRetry: 1 })) {
            return true;
        }
        return false;
    },

    login: function(account) {
        console.log("登录账号: " + account.name);
        Utils.randomSleep(1000, 2000);

        let phoneInput = VisionEngine.find(FindType.TEXT, "请输入手机号");
        if (!phoneInput) phoneInput = id(Config.PKG + ":id/phone_et").findOne(1000);
        if (!phoneInput) phoneInput = className("android.widget.EditText").findOne(1000);

        if (phoneInput) {
            phoneInput.setText(account.phone);
            Utils.randomSleep(300, 800);
        }

        // 密码登录
        let pwdBtn = VisionEngine.find(FindType.TEXT, "密码登录");
        if (pwdBtn) {
            Utils.clickElement(pwdBtn);
            let pwdInput = VisionEngine.find(FindType.TEXT, "请输入密码");
            if (!pwdInput) pwdInput = id(Config.PKG + ":id/password_et").findOne(1000);
            if (pwdInput) pwdInput.setText(account.password);
        } else {
            let oneKey = VisionEngine.find(FindType.TEXT, "一键登录");
            if (oneKey) {
                Utils.clickElement(oneKey);
                KuaishouApp.handlePopups();
                return KuaishouApp.isLoggedIn();
            }
        }

        // 勾选协议
        KuaishouApp.agreeProtocol();

        // 点击登录
        let loginBtn = id(Config.PKG + ":id/confirm_btn").findOne(1000);
        if (!loginBtn) loginBtn = VisionEngine.find(FindType.TEXT, "登录");
        if (loginBtn) {
            loginBtn.click();
            Utils.randomSleep(3000, 4000);
            KuaishouApp.handlePopups();
            return KuaishouApp.isLoggedIn();
        }
        return false;
    },

    logout: function() {
        console.log("正在退出当前账号...");
        try {
            VisionEngine.findAndClick(FindType.BOUNDS_BY_TEXT, "我");
            Utils.randomSleep(800, 1200);

            let moreBtn = VisionEngine.find(FindType.ID, Config.PKG + ":id/more_btn", { maxRetry: 3 });
            if (moreBtn) {
                moreBtn.click();
                Utils.randomSleep(800, 1200);
            }

            let settingsBtn = VisionEngine.find(FindType.ID, Config.PKG + ":id/bottom_right", { maxRetry: 3 });
            if (settingsBtn) {
                settingsBtn.click();
                Utils.randomSleep(500, 1000);
                // 滑动到底部
                Utils.switchVideo("up");
                Utils.switchVideo("up");
                Utils.switchVideo("up");

                let logoutBtn = VisionEngine.find(FindType.TEXT, "退出登录");
                if (logoutBtn) {
                    logoutBtn.click();
                    Utils.randomSleep(800, 1200);
                    let confirm = VisionEngine.find(FindType.BOUNDS_BY_TEXT, "退出登录");
                    if (confirm) Utils.clickElement(confirm);
                    return;
                }
            }
        } catch (e) {
            console.log("退出失败: " + e.message);
        }
        KuaishouApp.close();
        Utils.randomSleep(2000, 3000);
        KuaishouApp.open();
    },

    agreeProtocol: function() {
        let agree = textContains("我已阅读并同意").findOne(1500);
        if (agree) {
            let b = agree.bounds();
            click(b.left - 30, b.top + b.height() / 2);
            Utils.randomSleep(500, 800);
        }
    },

    handlePopups: function() {
        let agree = VisionEngine.find(FindType.TEXT, "同意并登录", { maxRetry: 2 });
        if (agree) Utils.clickElement(agree);
    },

    goToHome: function() {
        return VisionEngine.findAndClick(FindType.TEXT, "首页", { maxRetry: 3 });
    },

    goToProfile: function() {
        return VisionEngine.findAndClick(FindType.BOUNDS_BY_TEXT, "我", { maxRetry: 3 });
    },

    goToTaskCenter: function() {
        let btn = VisionEngine.find(FindType.ID, Config.PKG + ":id/left_btn", { maxRetry: 3 });
        if (!btn) btn = VisionEngine.find(FindType.DESC, "侧边栏", { maxRetry: 3 });
        if (btn) {
            Utils.clickElement(btn);
            Utils.randomSleep(800, 1200);
        }
        if (VisionEngine.findAndClick(FindType.TEXT, "任务中心", { maxRetry: 3 })) {
            Utils.randomSleep(1000, 1500);
            // 处理百亿金币弹窗
            let pop = VisionEngine.find(FindType.TEXT, "立即参与", { maxRetry: 2 });
            if (pop) back();
            return true;
        }
        return false;
    }
};

// ==================== 6. 任务中心业务 ====================
const TaskCenter = {
    // 连续打卡白拿手机
    continuousSign: function() {
        let btn = VisionEngine.find(FindType.CONTAINS, "连续打卡白拿手机");
        if (!btn) return;
        Utils.clickElement(btn);
        Utils.randomSleep(800, 1200);

        if (VisionEngine.findAndClick(FindType.TEXT, "重新选择商品")) {
            Utils.randomSleep(500, 800);
            let award = VisionEngine.find(FindType.TEXT, Config.SIGN_DAY_LABEL);
            if (award) {
                Utils.clickSibling(award, false); // 点击下一个兄弟（选择按钮）
                let start = VisionEngine.find(FindType.TEXT, "开启挑战");
                if (start) {
                    Utils.clickElement(start);
                    Utils.clickAnyPoint();
                }
            }
        }

        let signBtn = VisionEngine.find(FindType.TEXT, "去签到");
        if (signBtn) {
            Utils.clickElement(signBtn);
            Utils.randomSleep(1000, 2000);
            VisionEngine.findAndClick(FindType.TEXT, "明天一定来");
        }

        if (VisionEngine.find(FindType.CONTAINS, "完成365天打卡任务", { maxRetry: 1 })) {
            back();
        }
    },

    // 签到
    doSignIn: function() {
        console.log("执行签到...");
        let btn = VisionEngine.find(FindType.BOUNDS_BY_TEXT, "立即签到");
        if (btn) {
            Utils.clickPoint(btn.centerX(), btn.centerY(), "立即签到");
            return TaskCenter.checkSignResult();
        }
        console.log("未找到立即签到按钮");
        return false;
    },

    checkSignResult: function() {
        let successTexts = ["签到成功", "已签到", "签到完成", "领取成功", "已领取"];
        for (let t of successTexts) {
            if (VisionEngine.find(FindType.CONTAINS, t, { maxRetry: 2 })) {
                console.log("✓ 签到成功");
                return true;
            }
        }
        let already = ["今日已签到", "明天再来"];
        for (let t of already) {
            if (VisionEngine.find(FindType.CONTAINS, t, { maxRetry: 2 })) {
                console.log("✓ 今日已签到");
                return true;
            }
        }
        return false;
    },

    // 领福利广告
    doAdTask: function(count) {
        for (let i = 0; i < count; i++) {
            console.log("领福利广告 " + (i + 1) + "/" + count);
            let btn = VisionEngine.find(FindType.BOUNDS_BY_TEXT, "领福利");
            if (!btn) {
                console.log("未找到领福利按钮");
                continue;
            }
            Utils.clickElement(btn);
            Utils.randomSleep(300, 800);

            sleep(Utils.getRandomInt(30000, 31000));

            let gift = id(Config.PKG + ".commercial_neo:id/count_down_icon_container").findOne(1000);
            if (gift) {
                back();
            } else {
                let follow = VisionEngine.find(FindType.TEXT, "关注", { maxRetry: 1 });
                if (follow) {
                    back();
                    let exit = VisionEngine.find(FindType.BOUNDS_BY_TEXT, "退出");
                    if (exit) Utils.clickElement(exit);
                    return true;
                }
            }

            let closeBtn = VisionEngine.find(FindType.DESC, "close_view", { maxRetry: 2 });
            if (closeBtn) closeBtn.click();
        }
        return true;
    },

    // 看短剧
    doWatchShortVideo: function() {
        let btn = VisionEngine.find(FindType.TEXT, "看短剧");
        if (!btn) {
            console.log("看短剧按钮未找到");
            return false;
        }
        btn.click();
        console.log("已进入短剧页面");
        Utils.randomSleep(1000, 2000);

        for (let round = 0; round < 5; round++) {
            for (let i = 0; i < 4; i++) {
                if (Utils.switchVideo("up")) {
                    sleep(Utils.getRandomInt(10000, 11000));
                } else {
                    break;
                }
            }
            console.log("短剧第 " + (round + 1) + " 轮完成");
        }
        back();
        Utils.randomSleep(1000, 1500);
        return true;
    },

    // 去领取（挑战任务）
    doGoLingQu: function() {
        let btn = VisionEngine.find(FindType.TEXT, "去领取");
        if (!btn) return false;
        btn.click();
        Utils.randomSleep(800, 1200);

        // 判断是否进入推金币
        if (VisionEngine.find(FindType.TEXT, "钱包", { maxRetry: 1 })
            && VisionEngine.find(FindType.TEXT, "分享", { maxRetry: 1 })) {
            console.log("进入推金币，直接退出");
            back();
            return true;
        }

        // 处理断签
        let giveUp = text("放弃续签").findOne(1000);
        if (giveUp) {
            giveUp.click();
            Utils.randomSleep(300, 500);
            let confirm = VisionEngine.find(FindType.TEXT, "确认放弃");
            if (confirm) confirm.click();
            Utils.randomSleep(800, 1200);
        }

        // 抢30奖励
        let rush = VisionEngine.find(FindType.CONTAINS, "好礼不限量");
        if (rush) {
            rush.click();
            Utils.randomSleep(500, 800);
            let start = VisionEngine.find(FindType.TEXT, "开启挑战");
            if (start) {
                start.click();
                Utils.randomSleep(500, 800);
                click(device.width * 0.88, device.height * 0.55);
            }
        }

        // 去签到
        let signBtn = VisionEngine.find(FindType.TEXT, "去签到");
        if (signBtn) {
            signBtn.click();
            Utils.randomSleep(800, 1000);
            if (VisionEngine.find(FindType.CONTAINS, "任务完成", { maxRetry: 2 })) {
                console.log("任务完成");
            }
        }
        back();
        return true;
    },

    // 去搜索
    doSearch: function() {
        let btn = VisionEngine.find(FindType.TEXT, "去搜索");
        if (!btn) return;
        Utils.clickElement(btn);
        Utils.randomSleep(1000, 1500);

        let taskText = VisionEngine.find(FindType.CONTAINS, "已完成");
        if (!taskText) return;
        let arr = Utils.parseFraction(taskText.text());
        if (!arr) return;
        let [completed, total] = arr;
        total = Math.floor(total / 2);

        for (let i = completed; i < total; i++) {
            console.log("搜索任务 " + (i + 1) + "/" + total);
            let searchBtn = VisionEngine.find(FindType.BOUNDS_BY_TEXT, "搜索");
            if (searchBtn) {
                Utils.clickElement(searchBtn);
                Utils.randomSleep(26000, 28000);
                TaskCenter.successAward();
                Utils.randomSleep(500, 800);
                let closeBtn = VisionEngine.find(FindType.DESC, "close_view");
                if (closeBtn) Utils.clickElement(closeBtn);
            }
        }

        // 检查是否完成
        taskText = VisionEngine.find(FindType.CONTAINS, "已完成");
        if (taskText) {
            let arr2 = Utils.parseFraction(taskText.text());
            if (arr2 && arr2[0] === Math.floor(arr2[1] / 2)) {
                back();
                let confirm = VisionEngine.find(FindType.TEXT, "仍要退出");
                if (confirm) confirm.click();
            }
        }
    },

    // 点可领（单次执行）
    doGetGold: function() {
        let btn = VisionEngine.find(FindType.CONTAINS, "点可领");
        if (btn) {
            Utils.clickElement(btn);
            TaskCenter.closePopups();
        }
    },

    // 看直播得金币
    doLive: function() {
        let btn = VisionEngine.find(FindType.CONTAINS, "看直播得金币");
        if (!btn) return;
        Utils.clickElement(btn);
        Utils.randomSleep(800, 1200);

        let page = VisionEngine.find(FindType.CONTAINS, "看直播最高赚");
        if (!page) {
            back();
            return;
        }

        let liveVideo = id(Config.PKG + ":id/play_view_container").findOne(1000);
        if (liveVideo) {
            Utils.clickElement(liveVideo);
            Utils.randomSleep(30000, 31000);
            back();
            // 处理直播间返回弹窗
            let giveUp = VisionEngine.find(FindType.TEXT, "放弃奖励");
            if (giveUp) Utils.clickElement(giveUp);
            let exitLive = VisionEngine.find(FindType.TEXT, "退出直播间");
            if (exitLive) Utils.clickElement(exitLive);
        }
    },

    // 加载广告视频
    loadAd: function() {
        let btn = VisionEngine.find(FindType.TEXT, "去观看");
        if (btn) Utils.clickElement(btn);

        // 判断是否进入广告页
        let adPage = VisionEngine.find(FindType.TEXT_MATCHES, /\+\d+\s*金币/, { maxRetry: 2 });
        if (!adPage) {
            console.log("未进入广告页面");
            return false;
        }

        sleep(Utils.getRandomInt(15000, 17000));
        for (let i = 1; i < Config.WATCH_VIDEO_COUNT * 2; i++) {
            console.log("广告视频 " + i + "/" + (Config.WATCH_VIDEO_COUNT * 2));
            sleep(Utils.getRandomInt(15000, 17000));
            Utils.switchVideo("up");
        }
        return true;
    },

    // 领取奖励
    receiveAward: function() {
        let btn = VisionEngine.find(FindType.TEXT, "领取奖励");
        if (btn) {
            Utils.clickElement(btn);
            sleep(Utils.getRandomInt(26000, 30000));
            TaskCenter.successAward();
        }
    },

    successAward: function() {
        let msg = VisionEngine.find(FindType.CONTAINS, "已成功领取", { maxRetry: 2 });
        if (msg) back();
    },

    closePopups: function() {
        let lookAd = VisionEngine.find(FindType.CONTAINS, "去看广告得", { maxRetry: 2 });
        if (lookAd) {
            lookAd.click();
            TaskCenter.doAdTask(1);
        }
    },

    // 到饭点领饭补
    getLunchAward: function() {
        let btn = VisionEngine.find(FindType.CONTAINS, "到饭点领饭补");
        if (!btn) return;
        Utils.clickElement(btn);
        Utils.randomSleep(800, 1200);

        let buqian = VisionEngine.find(FindType.CONTAINS, "待补签");
        while (buqian && buqian.clickable()) {
            Utils.clickElement(buqian);
            sleep(Utils.getRandomInt(30000, 31000));
            if (VisionEngine.find(FindType.TEXT, "广告", { maxRetry: 1 })) back();
            buqian = VisionEngine.find(FindType.CONTAINS, "待补签");
        }

        let award = VisionEngine.find(FindType.TEXT_MATCHES, /领取饭补\d+金币/);
        if (award) {
            Utils.clickElement(award);
            Utils.randomSleep(500, 800);
            let closeBtn = className("android.widget.TextView").findOne(1000);
            if (closeBtn) Utils.clickElement(closeBtn);

            let moreAd = VisionEngine.find(FindType.CONTAINS, "看广告最多再得");
            if (moreAd) {
                Utils.clickElement(moreAd);
                sleep(Utils.getRandomInt(26000, 30000));
                TaskCenter.successAward();
                TaskCenter.receiveAward();
                if (VisionEngine.find(FindType.TEXT, "到点领饭补金币", { maxRetry: 1 })) back();
            }
        }
    },

    // 开盲盒
    openBindBox: function() {
        let btn = VisionEngine.find(FindType.CONTAINS, "开盲盒必得金币");
        if (!btn) return;
        Utils.clickElement(btn);
        Utils.randomSleep(500, 800);

        if (VisionEngine.findAndClick(FindType.TEXT, "开心收下")) {
            Utils.randomSleep(500, 800);
            if (VisionEngine.findAndClick(FindType.TEXT, "开盲盒")) {
                Utils.randomSleep(500, 800);
                if (VisionEngine.findAndClick(FindType.TEXT, "继续开盲盒")) {
                    if (VisionEngine.find(FindType.TEXT, "去分享", { maxRetry: 1 })) back();
                }
            }
        }
    },

    // 执行全部任务
    runAll: function() {
        console.log("\n========== 开始执行任务 ==========");
        TaskCenter.continuousSign();

        if (TaskCenter.doSignIn()) {
            console.log("签到成功");
        } else {
            console.log("签到失败，尝试返回重试");
            back();
            TaskCenter.doSignIn();
        }

        TaskCenter.loadAd();

        if (!TaskCenter.doAdTask(30)) {
            console.log("领福利广告异常");
        }

        if (!TaskCenter.doWatchShortVideo()) {
            console.log("看短剧异常");
        }

        TaskCenter.doGoLingQu();
        TaskCenter.doSearch();
        TaskCenter.getLunchAward();
        TaskCenter.openBindBox();
        TaskCenter.doLive();

        // 点可领：启动定时轮询（每 25 分钟一次，共 20 次，约 8 小时）
        Utils.scheduleTask(Config.GOLD_INTERVAL, TaskCenter.doGetGold, Config.GOLD_COUNT);

        console.log("========== 主任务执行完毕，点可领轮询已启动 ==========\n");
    }
};

// ==================== 7. 账号管理 ====================
const AccountManager = {
    load: function() {
        try {
            let str = files.read(Config.ACCOUNTS_FILE);
            let list = JSON.parse(str);
            console.log("加载账号配置，共 " + list.length + " 个");
            return list;
        } catch (e) {
            console.log("读取账号配置失败: " + e.message);
            toast("请先配置 accounts.json");
            return [];
        }
    }
};

// ==================== 8. 主入口 ====================
function main() {
    console.show();
    console.clear();
    console.log("========== 快手多账号自动签到（重构版 v2） ==========");
    console.log("时间: " + new Date().toLocaleString());
    console.log("设备分辨率: " + device.width + "x" + device.height);

    auto.waitFor();
    auto.setMode("normal");

    // 初始化视觉引擎（请求截图权限）
    try {
        VisionEngine.init();
    } catch (e) {
        console.log("视觉引擎初始化失败: " + e.message);
        return;
    }

    let accounts = AccountManager.load();
    if (accounts.length === 0) return;

    if (!KuaishouApp.open()) {
        console.log("打开快手失败");
        return;
    }

    let success = 0, fail = 0;

    for (let i = 0; i < accounts.length; i++) {
        let account = accounts[i];
        console.log("\n>>> 处理第 " + (i + 1) + "/" + accounts.length + " 个账号: " + account.name);

        if (i > 0) {
            KuaishouApp.logout();
            Utils.randomSleep(2000, 3000);
            KuaishouApp.open();
        }

        if (!KuaishouApp.isLoggedIn()) {
            if (!KuaishouApp.login(account)) {
                console.log("账号 " + account.name + " 登录失败");
                fail++;
                continue;
            }
        }

        if (!KuaishouApp.goToHome()) {
            console.log("进入首页失败");
            fail++;
            continue;
        }

        if (!KuaishouApp.goToTaskCenter()) {
            console.log("进入任务中心失败");
            fail++;
            continue;
        }

        TaskCenter.runAll();
        success++;

        if (i < accounts.length - 1) {
            Utils.randomSleep(3000, 5000);
        }
    }

    console.log("\n========== 签到统计 ==========");
    console.log("总账号: " + accounts.length + " 成功: " + success + " 失败: " + fail);
    toast("签到完成！成功: " + success + " 失败: " + fail);

    // 等待点可领轮询结束（如果启动了的话）
    console.log("等待后台轮询任务结束...");
    sleep(Config.GOLD_INTERVAL * Config.GOLD_COUNT + 5000);
    console.log("所有任务结束");

    console.hide();
}

main();
