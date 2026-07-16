"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./services/auth");
const update_1 = require("./services/update");
App({
    onLaunch() {
        (0, update_1.setupVersionUpdate)();
        (0, auth_1.ensureLoggedIn)().catch((err) => {
            console.error('微信登录失败', err);
        });
    },
    globalData: {},
});
