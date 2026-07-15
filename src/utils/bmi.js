"use strict";
/**
 * BMI 计算与健康分级（中国标准）。
 * 纯函数，便于单元测试。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcBmi = calcBmi;
exports.bmiCategory = bmiCategory;
/**
 * 计算 BMI = 体重(kg) / 身高(m)^2，结果保留 1 位小数。
 * 身高（cm）或体重无效时返回 null。
 */
function calcBmi(weightKg, heightCm) {
    if (heightCm === null || heightCm === undefined)
        return null;
    if (typeof weightKg !== 'number' || !isFinite(weightKg) || weightKg <= 0)
        return null;
    if (typeof heightCm !== 'number' || !isFinite(heightCm) || heightCm <= 0)
        return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    if (!isFinite(bmi))
        return null;
    return Math.round(bmi * 10) / 10;
}
/**
 * BMI 健康分级（中国标准）：
 * 偏瘦 < 18.5，正常 18.5–23.9，超重 24–27.9，肥胖 ≥ 28。
 */
function bmiCategory(bmi) {
    if (bmi === null || typeof bmi !== 'number' || !isFinite(bmi))
        return null;
    if (bmi < 18.5)
        return { label: '偏瘦', level: 'underweight' };
    if (bmi < 24)
        return { label: '正常', level: 'normal' };
    if (bmi < 28)
        return { label: '超重', level: 'overweight' };
    return { label: '肥胖', level: 'obese' };
}
