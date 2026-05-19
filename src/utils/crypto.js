"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hmacSha256 = hmacSha256;
// 本地 vendored 实现，无需微信「构建 npm」
// @ts-ignore CommonJS vendored lib
const sha256 = require('./sha256-lib');
/**
 * HMAC-SHA256，输出十六进制字符串（与 Node.js crypto 一致）
 */
function hmacSha256(key, message) {
    return sha256.hmac(key, message);
}
