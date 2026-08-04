# 快手自动签到脚本重构指南（Auto.js 6 / AutoX.js）

> **目标**：将原有纯 Accessibility 查找脚本，升级为支持 **OpenCV 图像识别 + 跨设备分辨率自适应 + 定时轮询** 的完整自动化方案，并最终可打包为 APK 独立运行。

---

## 一、为什么需要重构

原有脚本完全依赖 `id / desc / text / className` 等 Accessibility 属性查找元素，但在以下场景会失效：

| 失效场景 | 原因 |
|---------|------|
| 纯图标按钮（无文字） | `text` 为空，无法匹配 |
| 动态化 UI（Flutter / 小程序） | 控件树不稳定，`id` 随机生成 |
| 不同手机分辨率 | `bounds` 绝对坐标换设备就错 |
| 弹窗关闭按钮（X 图标） | 无 `text`、无 `desc`、无固定 `id` |

**解决方案**：引入 **OpenCV 图像模板匹配** 作为查找手段，配合 **比例坐标兜底**，实现真正的跨设备鲁棒性。

---

## 二、架构拆分（6 层结构）

重构后的脚本按职责拆分为 6 个模块：

```
┌─────────────────────────────────────────┐
│  1. 配置层 (Config)                      │  ← 所有常量集中管理
├─────────────────────────────────────────┤
│  2. 工具层 (Utils)                       │  ← 随机延迟、滑动、坐标转换、定时轮询
├─────────────────────────────────────────┤
│  3. 视觉引擎 (VisionEngine)              │  ← 核心：Accessibility + OpenCV + 比例兜底
├─────────────────────────────────────────┤
│  4. App 层 (KuaishouApp)                │  ← 打开/关闭/登录/退出/页面跳转
├─────────────────────────────────────────┤
│  5. 业务层 (TaskCenter)                 │  ← 签到、看广告、看短剧、去搜索等具体任务
├─────────────────────────────────────────┤
│  6. 入口层 (main)                        │  ← 账号轮询、流程编排、统计输出
└─────────────────────────────────────────┘
```

---

## 三、核心升级：VisionEngine 视觉引擎

### 3.1 查找类型枚举

```javascript
const FindType = Object.freeze({
    DESC: 1,           // 通过 content-desc 查找
    TEXT: 2,           // 通过 text 精确匹配
    CONTAINS: 3,       // 通过 text 模糊包含
    ID: 4,             // 通过 resource-id 查找
    CLASS_NAME: 5,     // 通过 className 查找
    BOUNDS_BY_TEXT: 6, // 通过 text 查找后返回 bounds
    TEXT_MATCHES: 7,   // 通过正则匹配 text
    IMAGE: 8,          // ⭐ 新增：OpenCV 图片模板匹配
    COLOR: 9,          // 新增：找色
    RATIO: 10,         // ⭐ 新增：比例坐标兜底
});
```

### 3.2 统一查找接口（替代原 `$` 函数）

```javascript
// 基础查找
let ele = VisionEngine.find(FindType.TEXT, "确定", { maxRetry: 3 });

// 查找并点击
VisionEngine.findAndClick(FindType.TEXT, "确定", { maxRetry: 3 });

// 等待元素出现
VisionEngine.waitFor(FindType.TEXT, "任务中心", { timeout: 10000 });

// 智能点击：先找图，找不到比例兜底
VisionEngine.smartClick(
    FindType.IMAGE, 
    "/sdcard/templates/btn.png",
    0.5,    // 兜底 X 比例
    0.85,   // 兜底 Y 比例
    { threshold: 0.8 }
);
```

**参数说明：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | `FindType` | 查找方式 |
| `keyword` | `string` | 查找关键词（TEXT 时填文字，IMAGE 时填图片路径，RATIO 时填 `"0.5,0.8"`） |
| `options.maxRetry` | `number` | 最大重试次数，默认从 keyword 解析或 Config 读取 |
| `options.threshold` | `number` | 图像匹配相似度阈值（0~1），默认 0.85 |
| `options.region` | `[x,y,w,h]` | 限定查找区域（基准分辨率坐标，自动缩放） |
| `options.autoScale` | `boolean` | 是否自动缩放模板适配当前设备，默认 `true` |

---

## 四、图像识别实战：找无特征元素

### 4.1 第一步：制作模板图

在基准手机上运行一次辅助脚本，截取目标图标：

```javascript
"auto";
if (!requestScreenCapture()) { toast("权限被拒绝"); exit(); }
sleep(1000);

let screen = captureScreen();

// 裁剪目标区域（根据布局分析获取 bounds）
// 例如：底部"我"图标在 bounds(900, 2200, 1000, 2300)
let clip = images.clip(screen, 900, 2200, 100, 100);
images.save(clip, "/sdcard/templates/tab_mine.png");
toast("模板已保存");

clip.recycle();
screen.recycle();
```

### 4.2 第二步：在业务中调用

#### 场景 A：纯图标按钮（无 text/id/desc）

```javascript
// 旧写法（失效）
// let btn = $(OperationType.TEXT, "我");

// 新写法：图片匹配
let found = VisionEngine.findAndClick(FindType.IMAGE, "/sdcard/templates/tab_mine.png", {
    threshold: 0.85,
    maxRetry: 5,
    region: [0, 2100, 1080, 300],  // 只在底部导航栏找
    autoScale: true                // 自动适配其他分辨率
});

if (!found) {
    console.log("图片匹配失败，启用比例兜底");
    VisionEngine.findAndClick(FindType.RATIO, "0.9,0.95");
}
```

#### 场景 B：弹窗关闭按钮（X 图标）

```javascript
VisionEngine.findAndClick(FindType.IMAGE, "/sdcard/templates/icon_close.png", {
    threshold: 0.8,
    maxRetry: 3,
    region: [800, 0, 280, 300]   // 只在右上角区域找
});
```

#### 场景 C：检测元素是否存在（不点击）

```javascript
let loading = VisionEngine.find(FindType.IMAGE, "/sdcard/templates/loading.png", {
    maxRetry: 1,
    threshold: 0.9
});

if (loading) {
    console.log("还在加载中...");
} else {
    console.log("加载完成");
}
```

### 4.3 区域限定（region）—— 提速 20 倍的关键

全屏找图需要扫描 200 多万像素，限定区域后可能只扫 10 万像素。

**常见区域参考（基准分辨率 1080x2400）：**

| 区域 | region `[x, y, w, h]` | 说明 |
|------|----------------------|------|
| 底部导航栏 | `[0, 2100, 1080, 300]` | 四个 Tab 图标 |
| 顶部标题栏 | `[0, 70, 1080, 120]` | 返回按钮、标题文字 |
| 右上角按钮 | `[900, 70, 180, 120]` | 更多、设置、关闭 |
| 屏幕正中弹窗 | `[200, 800, 680, 800]` | 确认对话框 |
| 右下角悬浮 | `[900, 2000, 180, 400]` | 客服、加号等 |

> 换到其他分辨率的手机时，`VisionEngine` 内部会自动按比例缩放 `region`，无需修改。

---

## 五、跨设备分辨率适配原理

### 5.1 基准缩放比例

```
你的基准手机（截图制作模板时用的）：1080 x 2400
用户A的手机：720 x 1600   → 自动缩放模板 0.667 倍
用户B的手机：1440 x 3200  → 自动缩放模板 1.333 倍
```

引擎内部自动计算：

```javascript
_baseScale = (device.width / BASE_WIDTH + device.height / BASE_HEIGHT) / 2;
```

### 5.2 多尺度匹配

为应对不同手机的 DPI 差异，引擎会尝试多个缩放比例：

```javascript
scales = [0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15].map(s => s * _baseScale);
```

只要其中任意一个比例匹配成功，即返回正确坐标。

### 5.3 比例坐标兜底（RATIO）

如果图像匹配也失败，直接用屏幕百分比点击：

```javascript
// 点击屏幕正下方 90% 处，任何分辨率都适用
VisionEngine.findAndClick(FindType.RATIO, "0.5,0.9");

// 智能点击：先找图，找不到就比例兜底
VisionEngine.smartClick(
    FindType.IMAGE, 
    "/sdcard/templates/btn_submit.png",
    0.5,    // 兜底 X：屏幕正中
    0.85,   // 兜底 Y：屏幕下方
    { threshold: 0.8, maxRetry: 3 }
);
```

---

## 六、定时轮询：scheduleTask

### 6.1 功能说明

`点可领` 任务需要每隔 25 分钟点击一次，共 20 次（约 8 小时），不能靠单次执行完成。

### 6.2 使用方式

```javascript
// 在 Utils 中封装
scheduleTask: function(timeout, func, execCount) {
    console.log("启动定时轮询，间隔 " + (timeout / 1000) + " 秒，共 " + execCount + " 次");
    let count = 0;

    // 首次立即执行
    try { func(); } catch (e) { console.log("首次执行异常: " + e.message); }
    count++;

    // 后续定时执行
    let timer = setInterval(() => {
        try { func(); } catch (e) { console.log("执行异常: " + e.message); }
        count++;
        if (count >= execCount) {
            clearInterval(timer);
            console.log("轮询结束，共执行 " + count + " 次");
        }
    }, timeout);
    return timer;
}

// 在业务中调用
Utils.scheduleTask(1500 * 1000, TaskCenter.doGetGold, 20);
// 含义：每 25 分钟执行一次 doGetGold，共执行 20 次（含首次立即执行）
```

### 6.3 配置参数化

```javascript
const Config = Object.freeze({
    GOLD_INTERVAL: 1500 * 1000,  // 25 分钟（毫秒）
    GOLD_COUNT: 20,              // 总共轮询 20 次
});
```

---

## 七、完整代码结构速览

```javascript
// ========== 1. 配置层 ==========
const Config = Object.freeze({
    PKG: "com.smile.gifmaker",
    ACCOUNTS_FILE: "accounts.json",
    BASE_WIDTH: 1080,
    BASE_HEIGHT: 2400,
    // ... 其他常量
});

// ========== 2. 查找类型枚举 ==========
const FindType = Object.freeze({
    DESC: 1, TEXT: 2, CONTAINS: 3, ID: 4,
    CLASS_NAME: 5, BOUNDS_BY_TEXT: 6, TEXT_MATCHES: 7,
    IMAGE: 8, COLOR: 9, RATIO: 10,
});

// ========== 3. 工具层 ==========
const Utils = {
    getRandomInt, randomSleep, parseKeyword, parseFraction,
    ratioToAbs, absToRatio, clickPoint, clickBounds,
    clickElement, clickSibling, getSlideConfig, switchVideo,
    clickAnyPoint, scheduleTask  // ← 包含定时轮询
};

// ========== 4. 视觉引擎 ==========
const VisionEngine = {
    init, find, findAndClick, smartClick, waitFor,
    captureTemplate, getScale
};

// ========== 5. App 层 ==========
const KuaishouApp = {
    open, close, isLoggedIn, login, logout,
    agreeProtocol, handlePopups,
    goToHome, goToProfile, goToTaskCenter
};

// ========== 6. 业务层 ==========
const TaskCenter = {
    continuousSign, doSignIn, checkSignResult,
    doAdTask, doWatchShortVideo, doGoLingQu, doSearch,
    doGetGold, doLive, loadAd, receiveAward, successAward,
    closePopups, getLunchAward, openBindBox, runAll
};

// ========== 7. 主入口 ==========
function main() {
    // 初始化 → 加载账号 → 循环登录 → 执行任务 → 统计输出
}
main();
```

---

## 八、打包 APK 注意事项

### 8.1 模板图路径

| 阶段 | 路径写法 |
|------|---------|
| Auto.js 内调试 | `/sdcard/templates/xxx.png` |
| 打包成 APK 后 | `./templates/xxx.png`（相对路径，模板图放项目目录） |

### 8.2 必需权限

打包时务必勾选：

- ✅ **无障碍服务**（Accessibility）
- ✅ **悬浮窗权限**（截图用）
- ✅ **前台服务**（保持后台运行）
- ✅ **存储权限**（读取模板图）

> 首次安装后，用户需手动在系统设置中开启**无障碍权限**和**悬浮窗权限**，这是 Android 系统限制，任何自动化框架都无法绕过。

### 8.3 基准分辨率设置

修改 `Config` 中的 `BASE_WIDTH` 和 `BASE_HEIGHT` 为你**制作模板图时用的那台手机**的分辨率。这是跨设备适配的基准原点。

---

## 九、常见问题 FAQ

### Q1：换了一台手机，模板图还能用吗？

**能。** `autoScale: true` 会自动计算缩放比例。但如果两台手机**长宽比差异很大**（如 16:9 vs 19.5:9），建议分别做一套模板。

### Q2：找图速度很慢怎么办？

**加 `region` 参数。** 全屏找图要扫描 200 多万像素，限定区域后可能只扫 10 万像素，速度提升 20 倍。

### Q3：图标颜色变了（如暗黑模式）怎么办？

- 做两套模板：`btn_light.png` 和 `btn_dark.png`，代码里依次尝试
- 或降低 `threshold` 到 `0.7`，让匹配更宽松

### Q4：图像匹配和 Accessibility 查找如何配合？

**推荐策略：分层兜底**

```javascript
// 第一层：最快的 Accessibility
let btn = VisionEngine.find(FindType.TEXT, "领福利", { maxRetry: 2 });
if (btn) { Utils.clickElement(btn); return; }

// 第二层：图像匹配（无特征元素）
let found = VisionEngine.findAndClick(FindType.IMAGE, "btn_lingfuli.png", {
    region: [0, 1800, 1080, 600],
    maxRetry: 3
});
if (found) return;

// 第三层：比例坐标兜底
VisionEngine.findAndClick(FindType.RATIO, "0.5,0.85");
```

### Q5：如何取消正在运行的 scheduleTask？

```javascript
let timerId = Utils.scheduleTask(1500000, myFunc, 20);
// 需要取消时：
clearInterval(timerId);
```

---

## 十、快速开始清单

1. ✅ 在基准手机上运行「截图辅助脚本」，保存 3~5 个关键图标模板到 `/sdcard/templates/`
2. ✅ 将模板图复制到项目目录的 `templates/` 文件夹下（用于打包）
3. ✅ 修改 `Config.BASE_WIDTH / BASE_HEIGHT` 为基准手机分辨率
4. ✅ 将原脚本里失效的 `$(OperationType.TEXT, "xxx")` 替换为 `VisionEngine.findAndClick(FindType.IMAGE, "路径")`
5. ✅ 给每个 `IMAGE` 调用加上 `region` 参数，限定查找范围
6. ✅ 在 `TaskCenter.runAll()` 末尾确认 `scheduleTask` 已启动
7. ✅ 在另一台不同分辨率的手机上测试，验证自动缩放是否生效
8. ✅ 使用 AutoX.js「打包应用」功能生成 APK

---

## 附录：关键 API 速查表

| API | 用途 | 示例 |
|-----|------|------|
| `VisionEngine.find(type, keyword, options)` | 查找元素 | `find(FindType.TEXT, "确定")` |
| `VisionEngine.findAndClick(type, keyword, options)` | 查找并点击 | `findAndClick(FindType.IMAGE, "btn.png")` |
| `VisionEngine.waitFor(type, keyword, options)` | 等待元素出现 | `waitFor(FindType.TEXT, "加载完成", {timeout: 10000})` |
| `VisionEngine.smartClick(type, keyword, rx, ry, options)` | 先找图，失败比例兜底 | `smartClick(FindType.IMAGE, "btn.png", 0.5, 0.8)` |
| `VisionEngine.captureTemplate(path, x, y, w, h)` | 截图保存模板 | `captureTemplate("btn.png", 900, 2200, 100, 100)` |
| `Utils.scheduleTask(timeout, func, count)` | 定时轮询 | `scheduleTask(1500000, doGetGold, 20)` |
| `Utils.clickElement(ele)` | 智能向上查找可点击父元素 | `clickElement(textBtn)` |
| `Utils.ratioToAbs(rx, ry)` | 比例转绝对坐标 | `ratioToAbs(0.5, 0.9)` |
