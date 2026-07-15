"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../services/api");
const bmi_1 = require("../../utils/bmi");
Page({
    data: {
        loading: false,
        dateLabel: '',
        morningWeight: null,
        morningTime: '--:--',
        morningChange: '暂无对比数据',
        morningBodyFat: null,
        eveningWeight: null,
        eveningTime: '--:--',
        eveningChange: '暂无对比数据',
        eveningBodyFat: null,
        height: null,
        bmiValue: '',
        bmiLabel: '',
        bmiLevel: '',
        chartReady: false,
        dateRangeStart: '',
        chartLineData: [],
    },
    onLoad() {
        wx.showShareMenu({
            menus: ['shareAppMessage'],
        });
        this.loadData();
    },
    onShow() {
        this.loadData();
    },
    async loadData() {
        var _a, _b, _c, _d;
        this.setData({ loading: true });
        this.loadHeight();
        const today = this.getTodayStr();
        const weekAgo = this.getDaysAgoStr(6);
        // 设置日期标签
        const now = new Date();
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        this.setData({
            dateLabel: `${now.getMonth() + 1}月${now.getDate()}日, ${weekdays[now.getDay()]}`,
        });
        try {
            // 获取7天记录
            const records = await (0, api_1.getWeightRecords)({
                startDate: weekAgo,
                endDate: today,
                pageSize: 200,
            });
            // 获取今天早晨和晚上的记录
            const todayRecords = records.filter((r) => r.date === today);
            const morningRec = todayRecords.find((r) => r.period === 'morning');
            const eveningRec = todayRecords.find((r) => r.period === 'evening');
            // 计算变化
            let morningChangeText = '暂无对比数据';
            let eveningChangeText = '暂无对比数据';
            const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));
            const morningRecords = sortedRecords.filter((r) => r.period === 'morning');
            if (morningRecords.length >= 2) {
                const latest = morningRecords[0];
                const prev = morningRecords[1];
                if (latest && prev) {
                    const diff = (latest.weight - prev.weight).toFixed(1);
                    const label = this.isConsecutiveDay(latest.date, prev.date) ? '较昨日' : '较上条';
                    morningChangeText = `${parseFloat(diff) >= 0 ? '+' : ''}${diff}kg ${label}`;
                }
            }
            if (morningRec && eveningRec) {
                const diff = (eveningRec.weight - morningRec.weight).toFixed(1);
                eveningChangeText = `${parseFloat(diff) >= 0 ? '+' : ''}${diff}kg 较早晨`;
            }
            const weekAgoDate = new Date(weekAgo);
            this.setData({
                loading: false,
                morningWeight: (_a = morningRec === null || morningRec === void 0 ? void 0 : morningRec.weight) !== null && _a !== void 0 ? _a : null,
                morningTime: morningRec ? this.formatTime(new Date(morningRec.createdAt)) : '--:--',
                morningChange: morningChangeText,
                morningBodyFat: (_b = morningRec === null || morningRec === void 0 ? void 0 : morningRec.bodyFat) !== null && _b !== void 0 ? _b : null,
                eveningWeight: (_c = eveningRec === null || eveningRec === void 0 ? void 0 : eveningRec.weight) !== null && _c !== void 0 ? _c : null,
                eveningTime: eveningRec ? this.formatTime(new Date(eveningRec.createdAt)) : '--:--',
                eveningChange: eveningChangeText,
                eveningBodyFat: (_d = eveningRec === null || eveningRec === void 0 ? void 0 : eveningRec.bodyFat) !== null && _d !== void 0 ? _d : null,
                dateRangeStart: `${weekAgoDate.getMonth() + 1}/${weekAgoDate.getDate()}`,
            });
            this.updateBmi();
            // 提取早晨和晚间数据，保留日期信息用于统一日期轴对齐
            const morningRecs = records
                .filter((r) => r.period === 'morning')
                .sort((a, b) => a.date.localeCompare(b.date));
            const eveningRecs = records
                .filter((r) => r.period === 'evening')
                .sort((a, b) => a.date.localeCompare(b.date));
            const morningSeries = morningRecs.map((r) => r.weight);
            const eveningSeries = eveningRecs.map((r) => r.weight);
            // 建立统一日期轴
            const allDates = [...new Set(records.map((r) => r.date))].sort();
            const dateMap = new Map(allDates.map((d, i) => [d, i]));
            this.setData({ chartLineData: morningSeries });
            setTimeout(() => {
                this.drawSparkline(morningRecs, eveningRecs, allDates, dateMap);
            }, 100);
        }
        catch (e) {
            console.error('loadData error:', e);
            this.setData({ loading: false });
        }
    },
    getTodayStr() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    loadHeight() {
        const cached = wx.getStorageSync('userHeight');
        if (typeof cached === 'number' && cached > 0) {
            this.setData({ height: cached });
            this.updateBmi();
        }
        (0, api_1.getProfile)()
            .then((profile) => {
            const height = profile.height;
            if (height !== null && height !== undefined) {
                wx.setStorageSync('userHeight', height);
                this.setData({ height });
            }
            else {
                this.setData({ height: null });
            }
            this.updateBmi();
        })
            .catch((e) => {
            console.error('loadHeight error:', e);
        });
    },
    updateBmi() {
        var _a;
        // 以最新记录计算 BMI：优先晚间，其次早晨。
        const weight = (_a = this.data.eveningWeight) !== null && _a !== void 0 ? _a : this.data.morningWeight;
        if (weight === null || weight === undefined) {
            this.setData({ bmiValue: '', bmiLabel: '', bmiLevel: '' });
            return;
        }
        const bmi = (0, bmi_1.calcBmi)(weight, this.data.height);
        if (bmi === null) {
            this.setData({ bmiValue: '', bmiLabel: '', bmiLevel: '' });
            return;
        }
        const category = (0, bmi_1.bmiCategory)(bmi);
        this.setData({
            bmiValue: bmi.toFixed(1),
            bmiLabel: category ? category.label : '',
            bmiLevel: category ? category.level : '',
        });
    },
    getDaysAgoStr(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    formatTime(d) {
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    isConsecutiveDay(date1, date2) {
        const [y1, m1, d1] = date1.split('-').map(Number);
        const [y2, m2, d2] = date2.split('-').map(Number);
        const d1Date = new Date(y1, m1 - 1, d1);
        const d2Date = new Date(y2, m2 - 1, d2);
        const diffMs = d1Date.getTime() - d2Date.getTime();
        return diffMs === 86400000; // 1 day in ms
    },
    drawSparkline(morningRecs, eveningRecs, allDates, dateMap) {
        // 建立统一日期轴对齐数据：按日期映射权重，无数据处为 null
        const alignedMorning = allDates.map(d => { var _a, _b; return (_b = (_a = morningRecs.find((r) => r.date === d)) === null || _a === void 0 ? void 0 : _a.weight) !== null && _b !== void 0 ? _b : null; });
        const alignedEvening = allDates.map(d => { var _a, _b; return (_b = (_a = eveningRecs.find((r) => r.date === d)) === null || _a === void 0 ? void 0 : _a.weight) !== null && _b !== void 0 ? _b : null; });
        const hasMorning = alignedMorning.some(v => v !== null);
        const hasEvening = alignedEvening.some(v => v !== null);
        if (!hasMorning && !hasEvening) {
            this.setData({ chartReady: true });
            return;
        }
        const query = wx.createSelectorQuery();
        query.select('.chart-canvas').node((res) => {
            if (!res || !res.node) {
                this.setData({ chartReady: true });
                return;
            }
            const canvas = res.node;
            const ctx = canvas.getContext('2d');
            const dpr = wx.getSystemInfoSync().pixelRatio || 2;
            const width = 335;
            const height = 168;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, width, height);
            // 合并数据计算 Y 轴范围（只计算有效值）
            const allWeights = [...alignedMorning.filter(v => v !== null), ...alignedEvening.filter(v => v !== null)];
            const minVal = Math.min(...allWeights) - 2;
            const maxVal = Math.max(...allWeights) + 2;
            const range = maxVal - minVal || 1;
            const padding = 16;
            const chartW = width - padding * 2;
            const chartH = height - 24;
            const n = allDates.length;
            const getXAligned = (i) => padding + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
            const getY = (v) => chartH - ((v - minVal) / range) * (chartH - 20) + 10;
            const buildPoints = (data) => {
                const pts = [];
                for (let i = 0; i < data.length; i++) {
                    if (data[i] !== null) {
                        pts.push({ x: getXAligned(i), y: getY(data[i]) });
                    }
                }
                return pts;
            };
            const drawLine = (alignedData, color, fillAlpha) => {
                const points = buildPoints(alignedData);
                if (points.length === 0)
                    return;
                // 区域填充
                ctx.beginPath();
                ctx.moveTo(points[0].x, chartH);
                for (const p of points) {
                    ctx.lineTo(p.x, p.y);
                }
                ctx.lineTo(points[points.length - 1].x, chartH);
                ctx.closePath();
                ctx.fillStyle = color + Math.round(fillAlpha * 255).toString(16).padStart(2, '0');
                ctx.fill();
                // 折线
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 4;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.stroke();
                // 数据点
                for (const p of points) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };
            drawLine(alignedMorning, '#FF8A3D', 0.08);
            drawLine(alignedEvening, '#6D5DFC', 0.08);
            this.setData({ chartReady: true });
        }).exec();
    },
    onAddTap() {
        wx.navigateTo({
            url: '/pages/record/index',
        });
    },
    onProfileTap() {
        wx.switchTab({
            url: '/pages/profile/index',
        });
    },
    onChartLongPress() {
        wx.switchTab({
            url: '/pages/trend/index',
        });
    },
    onShareAppMessage() {
        return {
            title: '一起记录每天的体重节律',
            path: '/pages/home/index',
        };
    },
});
