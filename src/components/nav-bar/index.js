"use strict";
Component({
    properties: {
        currentIndex: {
            type: Number,
            value: 0,
        },
    },
    data: {
        tabs: [
            { label: '总览', icon: '📊', bgColorClass: '' },
            { label: '记录', icon: '✏️', bgColorClass: '' },
            { label: '趋势', icon: '📈', bgColorClass: '' },
            { label: '动态', icon: '💬', bgColorClass: '' },
        ],
    },
    methods: {
        onTabTap(e) {
            const index = e.currentTarget.dataset.index;
            const pageMap = {
                0: '/pages/home/index',
                1: '/pages/record/index',
                2: '/pages/trend/index',
                3: '/pages/history/index',
            };
            const target = pageMap[index];
            if (target) {
                wx.switchTab({ url: target });
            }
        },
    },
});
