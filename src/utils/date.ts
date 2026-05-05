// 日期格式化工具

/**
 * 格式化日期为 YYYY-MM-DD（API 格式）
 */
export function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 格式化日期为 M月d日
 */
export function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 格式化日期为 M/d
 */
export function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 格式化完整日期为 M月d日, EEEE
 */
export function formatFullDate(date: Date): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getMonth() + 1}月${date.getDate()}日, ${weekdays[date.getDay()]}`;
}

/**
 * 解析 YYYY-MM-DD 字符串为 Date 对象
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 获取 N 天前的日期
 */
export function daysAgo(n: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date;
}

/**
 * 获取今天日期字符串 YYYY-MM-DD
 */
export function today(): string {
  return formatDateForApi(new Date());
}