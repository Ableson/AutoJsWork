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
        duration: 400               // 滑动时长400毫秒
    },
    RIGHT_TO_LEFT: { // 左滑（下一个视频）：从右4/5滑到左1/5
        startX: screenWidth * 0.8,
        startY: screenHeight * 0.5,
        endX: screenWidth * 0.2,
        endY: screenHeight * 0.5,
        duration: 400
    },
    // 上下滑动（切换视频：上滑下一个/下滑上一个，适合部分平台）
    TOP_TO_BOTTOM: { // 下滑（上一个）：从上1/5滑到下4/5
        startX: screenWidth * 0.5,
        startY: screenHeight * 0.2,
        endX: screenWidth * 0.5,
        endY: screenHeight * 0.8,
        duration: 400
    },
    BOTTOM_TO_TOP: { // 上滑（下一个）：从下4/5滑到上1/5
        startX: screenWidth * 0.5,
        startY: screenHeight * 0.8,
        endX: screenWidth * 0.5,
        endY: screenHeight * 0.2,
        duration: 400
    }
};

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

/**
 * 生成指定范围的随机小数
 * @param {Number} min 最小值
 * @param {Number} max 最大值
 * @param {Number} decimal 保留小数位数（默认2位）
 * @return {Number} 随机小数
 */
function getRandomFloat(min, max, decimal = 2) {
    if (min > max) {
        [min, max] = [max, min];
    }
    // 生成随机小数，toFixed 保留指定小数位，再转成数字（避免返回字符串）
    return Number((Math.random() * (max - min) + min).toFixed(decimal));
}