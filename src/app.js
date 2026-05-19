"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./services/auth");
App({
    onLaunch() {
        (0, auth_1.ensureLoggedIn)().catch((err) => {
            console.error('微信登录失败', err);
        });
    },
    globalData: {},
});
