/**
 * 模板裁剪工具 v2 - 自动生成模板图 + 输出调用代码
 * 用法：在目标界面运行，只需输入左上角和右下角坐标，自动计算宽高
 */

"auto";
if (!requestScreenCapture()) {
    toast("截图权限被拒绝");
    exit();
}
sleep(1000);

// 截图
let screen = captureScreen();
let sw = screen.getWidth();
let sh = screen.getHeight();
console.log("屏幕分辨率: " + sw + "x" + sh);

// 获取用户输入：只需左上角和右下角坐标
dialogs.alert("裁剪提示", "请用 Auto.js 布局分析查看目标元素的 bounds()\n格式: bounds(left, top, right, bottom)");

let x1 = dialogs.rawInput("① 左上角 X (left)", "1260") * 1;
let y1 = dialogs.rawInput("② 左上角 Y (top)", "570") * 1;
let x2 = dialogs.rawInput("③ 右下角 X (right)", "1340") * 1;
let y2 = dialogs.rawInput("④ 右下角 Y (bottom)", "650") * 1;

// 自动计算宽高
let x = Math.min(x1, x2);
let y = Math.min(y1, y2);
let w = Math.abs(x2 - x1);
let h = Math.abs(y2 - y1);

// 边界保护
x = Math.max(0, x);
y = Math.max(0, y);
w = Math.min(w, sw - x);
h = Math.min(h, sh - y);

console.log("计算结果: x=" + x + ", y=" + y + ", w=" + w + ", h=" + h);

// 裁剪并保存
let clip = images.clip(screen, x, y, w, h);

// 让用户输入保存名称
let name = dialogs.rawInput("⑤ 模板名称（不含后缀）", "popup_close_x");
let savePath = "/sdcard/templates/" + name + ".png";
images.save(clip, savePath);

toast("模板已保存: " + savePath);

// 自动计算 region 搜索区域（比模板稍大，用于图像匹配时限定范围）
let margin = Math.max(Math.floor(w * 0.3), 20);  // 至少扩展 30% 或 20px
let rx = Math.max(0, x - margin);
let ry = Math.max(0, y - margin);
let rw = Math.min(w + margin * 2, sw - rx);
let rh = Math.min(h + margin * 2, sh - ry);
let region = "[" + rx + ", " + ry + ", " + rw + ", " + rh + "]";

// 输出完整调用代码
console.log("\n====================================");
console.log("✅ 模板已保存: " + savePath);
console.log("====================================");
console.log("\n📋 复制下面的代码到你的脚本中：");
console.log("------------------------------------");
console.log('// ' + name + ' - 图像查找');
console.log('VisionEngine.findAndClick(FindType.IMAGE, "' + savePath + '", {');
console.log('    threshold: 0.82,');
console.log('    maxRetry: 1,');
console.log('    region: ' + region + ',  // 基于 ' + sw + 'x' + sh);
console.log('    autoScale: true');
console.log('});');
console.log("------------------------------------");

// 同时输出比例坐标（用于兜底）
let ratioX = (x + w / 2) / sw;
let ratioY = (y + h / 2) / sh;
console.log("\n📍 比例坐标兜底（如果图像匹配失败）：");
console.log('VisionEngine.findAndClick(FindType.RATIO, "' + ratioX.toFixed(4) + ',' + ratioY.toFixed(4) + '");');

// 预览图
let preview = images.scale(clip, 4, 4);
images.save(preview, "/sdcard/templates/preview_" + name + ".png");
console.log("\n🔍 预览图: /sdcard/templates/preview_" + name + ".png");

clip.recycle();
preview.recycle();
screen.recycle();
