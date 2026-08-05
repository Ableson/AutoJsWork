# 模板裁剪工具 v2 使用文档

> **用途**：在 Auto.js / AutoX.js 中快速裁剪任意 UI 元素模板，自动生成图像识别调用代码 + 比例坐标兜底代码。
> 
> **优势**：只需输入 4 个坐标（左上角 + 右下角），自动计算宽高和搜索区域。

---

## 一、前置准备

1. **安装 Auto.js 6 或 AutoX.js**
2. **开启截图权限**：首次运行会弹窗请求，必须允许
3. **准备目标界面**：打开你要裁剪的元素所在的页面（如弹窗、按钮等）

---

## 二、快速开始

### 步骤 1：查看元素坐标

打开 Auto.js → 右上角菜单 → **「布局分析」** → 点击目标元素 → 查看 `bounds()` 值：

```
bounds(left, top, right, bottom)
```

**示例**：右上角 X 关闭按钮
```
bounds(1267, 576, 1382, 691)
```

### 步骤 2：运行工具脚本

将 `capture_tool_v2.js` 保存到 Auto.js，在目标界面运行。

按提示输入 5 项：

| 输入项 | 含义 | 示例值 |
|--------|------|--------|
| `① 左上角 X (left)` | bounds 第 1 个数 | `1267` |
| `② 左上角 Y (top)` | bounds 第 2 个数 | `576` |
| `③ 右下角 X (right)` | bounds 第 3 个数 | `1382` |
| `④ 右下角 Y (bottom)` | bounds 第 4 个数 | `691` |
| `⑤ 模板名称` | 保存的文件名（不含后缀） | `popup_close_x` |

### 步骤 3：自动计算并保存

工具会自动计算：
- 裁剪区域：`x=left`, `y=top`, `w=right-left`, `h=bottom-top`
- 搜索区域 `region`：在模板基础上扩展 30% 边距（用于图像匹配时限定范围）
- 比例坐标：`(x+w/2)/屏幕宽, (y+h/2)/屏幕高`

模板保存到：`/sdcard/templates/{名称}.png`

---

## 三、输出代码说明

运行完成后，控制台会输出两段可直接复制使用的代码：

### 1. 图像查找（主方案）

```javascript
// popup_close_x - 图像查找
VisionEngine.findAndClick(FindType.IMAGE, "/sdcard/templates/popup_close_x.png", {
    threshold: 0.82,
    maxRetry: 1,
    region: [1227, 536, 195, 195],  // 基于 1440x3200
    autoScale: true
});
```

| 参数 | 说明 |
|------|------|
| `threshold: 0.82` | 相似度阈值（0~1），清晰图标设 0.82~0.85，模糊/半透明设 0.75 |
| `maxRetry: 1` | 弹窗检测只查 1 次，业务查找可设 3~5 |
| `region` | 限定搜索区域，避免全屏扫描，提速 20 倍 |
| `autoScale: true` | 自动适配不同分辨率手机 |

### 2. 比例坐标兜底（图像失败时用）

```javascript
// 比例坐标兜底
VisionEngine.findAndClick(FindType.RATIO, "0.9108,0.1891");
```

当图像匹配失败（如换手机后图标风格变化），直接用屏幕百分比点击，不依赖任何图像。

---

## 四、代码放哪里

### 情况 A：通用弹窗关闭按钮 → 放 `PopupHandler`

如果各种页面都可能出现这个关闭按钮：

```javascript
const PopupHandler = {
    // ... 原有代码 ...

    /**
     * 新增：中间弹窗关闭按钮
     */
    findCloseCenter: function(detectOnly) {
        try {
            let res = VisionEngine.find(FindType.IMAGE, "/sdcard/templates/popup_close_center.png", {
                threshold: 0.82,
                maxRetry: 1,
                region: [600, 800, 240, 200],  // 工具自动生成的 region
                autoScale: true
            });
            if (res && res.found) {
                if (!detectOnly) {
                    console.log("🎯 点击中间关闭按钮");
                    click(res.x, res.y);
                    sleep(500);
                }
                return true;
            }
        } catch (e) {}
        return false;
    },

    // 检测方法也要加上
    hasPopup: function() {
        return text("连续签到").findOnce()
            || PopupHandler.findCloseX(true)
            || PopupHandler.findCloseCenter(true);  // ← 新增
    }
};
```

### 情况 B：特定业务按钮 → 放对应业务方法里

如果按钮只在某个特定页面出现：

```javascript
// 放在 TaskCenter 的对应方法中
doAdTask: function() {
    // ... 业务逻辑 ...

    // 这个活动页面专属的关闭按钮
    let closeBtn = VisionEngine.find(FindType.IMAGE, "/sdcard/templates/ad_page_close.png", {
        threshold: 0.8,
        maxRetry: 2,
        region: [1200, 0, 240, 200]
    });
    if (closeBtn && closeBtn.found) {
        click(closeBtn.x, closeBtn.y);
    }
}
```

---

## 五、常见场景坐标参考

以下坐标基于 **1440×3200**（小米11 Pro），其他手机等比例换算：

| 元素 | bounds 示例 | 工具输入 |
|------|------------|---------|
| 右上角 X 关闭 | `(1267, 576, 1382, 691)` | `1267, 576, 1382, 691` |
| 底部导航栏图标 | `(0, 2880, 360, 3200)` | `0, 2880, 360, 3200` |
| 屏幕正中按钮 | `(400, 1600, 1040, 1720)` | `400, 1600, 1040, 1720` |
| 右下角悬浮按钮 | `(1200, 2600, 1400, 2800)` | `1200, 2600, 1400, 2800` |
| 弹窗底部关闭 | `(600, 2000, 840, 2080)` | `600, 2000, 840, 2080` |

---

## 六、常见问题

### Q1：图像匹配失败怎么办？

在控制台运行调试脚本，定位问题：

```javascript
"auto";
requestScreenCapture(); sleep(800);

let template = images.read("/sdcard/templates/你的模板.png");
let screen = captureScreen();

// 全屏匹配（不限制 region），看能不能找到
let point = images.findImage(screen, template, { threshold: 0.7 });
if (point) {
    console.log("✅ 匹配成功: (" + point.x + ", " + point.y + ")");
} else {
    console.log("❌ 未匹配到，尝试降低 threshold 到 0.75 或 0.70");
}

template.recycle();
screen.recycle();
```

### Q2：换了手机分辨率不同，模板还能用吗？

**能。** `autoScale: true` 会自动缩放。但如果长宽比差异很大，建议：
1. 在新手机上重新运行 `capture_tool_v2` 裁剪一次
2. 或降低 `threshold` 到 `0.75`

### Q3：弹窗有动画，截图时元素位置变了？

等动画结束再运行工具：

```javascript
// 在脚本开头加延迟，等弹窗动画完成
sleep(1000);  // 等 1 秒动画
// 然后再运行 capture_tool_v2
```

### Q4：region 范围怎么理解？

`region` 是**搜索范围**，比模板本身稍大：

```
模板:     [1267, 576, 115, 115]
region:   [1227, 536, 195, 195]  ← 四周各扩展 40px
```

这样即使弹窗位置有轻微偏移，也能匹配到，同时避免全屏扫描。

---

## 七、完整决策流程

```
遇到新按钮/弹窗需要裁剪模板？
    │
    ├─→ 打开 Auto.js 布局分析，复制 bounds()
    │
    ├─→ 运行 capture_tool_v2.js
    │       ├─→ 输入 left, top, right, bottom
    │       ├─→ 输入模板名称
    │       └─→ 自动保存 + 输出代码
    │
    ├─→ 复制控制台的图像查找代码
    │
    └─→ 判断按钮类型
            ├─→ 通用弹窗关闭？→ 放 PopupHandler
            └─→ 特定业务按钮？→ 放对应业务方法
```

---

## 八、文件结构建议

```
/sdcard/templates/
├── popup_close_x.png          # 右上角 X（通用弹窗）
├── popup_close_center.png     # 中间弹窗关闭
├── tab_mine.png               # 底部"我"图标
├── btn_lingfuli.png           # 领福利按钮
├── btn_signin.png             # 立即签到按钮
├── icon_task.png              # 任务中心入口
└── preview_xxx.png            # 预览图（可删除）
```

---

> **提示**：所有模板图建议保留原始截图备份，方便后续调整 `region` 或 `threshold`。
