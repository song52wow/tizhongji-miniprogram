"use strict";
// 日期格式化工具
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateForApi = formatDateForApi;
exports.formatMonthDay = formatMonthDay;
exports.formatShortDate = formatShortDate;
exports.formatFullDate = formatFullDate;
exports.parseDate = parseDate;
exports.daysAgo = daysAgo;
exports.today = today;
/**
 * 格式化日期为 YYYY-MM-DD（API 格式）
 */
function formatDateForApi(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/**
 * 格式化日期为 M月d日
 */
function formatMonthDay(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}
/**
 * 格式化日期为 M/d
 */
function formatShortDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
}
/**
 * 格式化完整日期为 M月d日, EEEE
 */
function formatFullDate(date) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${date.getMonth() + 1}月${date.getDate()}日, ${weekdays[date.getDay()]}`;
}
/**
 * 解析 YYYY-MM-DD 字符串为 Date 对象
 */
function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}
/**
 * 获取 N 天前的日期
 */
function daysAgo(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date;
}
/**
 * 获取今天日期字符串 YYYY-MM-DD
 */
function today() {
    return formatDateForApi(new Date());
}
