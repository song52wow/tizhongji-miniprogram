"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../services/api");
const bmi_1 = require("../../utils/bmi");
Page({
    data: {
        loading: false,
        saving: false,
        errorMsg: '',
        dateDisplay: '',
        selectedDate: '',
        maxDate: '',
        selectedPeriod: 'morning',
        weightInput: '',
        bodyFatInput: '',
        noteInput: '',
        existingRecord: null,
        height: null,
        bmiValue: '',
        bmiLabel: '',
        bmiLevel: '',
    },
    onLoad(options) {
        const dateFromOptions = options.date;
        const periodFromOptions = options.period;
        let selectedDate;
        let displayParts;
        if (dateFromOptions) {
            selectedDate = dateFromOptions;
            const [y, m, d] = dateFromOptions.split('-').map(Number);
            displayParts = [d, m, y];
        }
        else {
            const today = new Date();
            selectedDate = this.formatDateForApi(today);
            displayParts = [today.getDate(), today.getMonth() + 1, today.getFullYear()];
        }
        const selectedPeriod = periodFromOptions === 'evening' ? 'evening' : 'morning';
        this.setData({
            selectedDate,
            dateDisplay: `${displayParts[0]}/${displayParts[1]}/${displayParts[2]}`,
            maxDate: this.formatDateForApi(new Date()),
            selectedPeriod,
        });
        this.loadHeight();
        this.loadExistingRecord();
    },
    onShow() {
        this.loadHeight();
        this.loadExistingRecord();
    },
    loadHeight() {
        // 优先读本地缓存，命中即用；否则回落到接口。
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
        const weight = parseFloat(this.data.weightInput);
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
    formatDateForApi(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    async loadExistingRecord() {
        const { selectedDate, selectedPeriod } = this.data;
        this.setData({ loading: true, errorMsg: '' });
        try {
            const records = await (0, api_1.getWeightRecords)({
                startDate: selectedDate,
                endDate: selectedDate,
                period: selectedPeriod,
                pageSize: 10,
            });
            if (records && records.length > 0) {
                const rec = records[0];
                this.setData({
                    loading: false,
                    existingRecord: rec,
                    weightInput: rec.weight.toFixed(1),
                    bodyFatInput: rec.bodyFat !== undefined && rec.bodyFat !== null ? String(rec.bodyFat) : '',
                    noteInput: rec.note || '',
                    selectedPeriod: rec.period,
                });
                this.updateBmi();
            }
            else {
                this.setData({
                    loading: false,
                    existingRecord: null,
                    weightInput: '',
                    bodyFatInput: '',
                    noteInput: '',
                });
                this.updateBmi();
            }
        }
        catch (e) {
            console.error('loadExistingRecord error:', e);
            this.setData({ loading: false });
        }
    },
    onDateChange(e) {
        const val = e.detail.value;
        if (!val)
            return;
        const [y, m, d] = val.split('-').map(Number);
        this.setData({
            selectedDate: val,
            dateDisplay: `${d}/${m}/${y}`,
            existingRecord: null,
            weightInput: '',
            bodyFatInput: '',
            noteInput: '',
        });
        this.updateBmi();
        this.loadExistingRecord();
    },
    onPeriodChange(e) {
        const period = e.currentTarget.dataset.period;
        if (period === this.data.selectedPeriod)
            return;
        this.setData({
            selectedPeriod: period,
            existingRecord: null,
            weightInput: '',
            bodyFatInput: '',
            noteInput: '',
            loading: true,
        });
        this.updateBmi();
        this.loadExistingRecord();
    },
    onWeightInput(e) {
        let value = e.detail.value;
        // 限制为最多一位小数
        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts[1].length > 1) {
                // 截断超过一位的小数部分（避免 toFixed 截断问题）
                value = parts[0] + '.' + parts[1].slice(0, 1);
            }
        }
        this.setData({ weightInput: value });
        this.updateBmi();
    },
    onBodyFatInput(e) {
        let value = e.detail.value;
        if (value.includes('.')) {
            const parts = value.split('.');
            if (parts[1].length > 1) {
                value = parts[0] + '.' + parts[1].slice(0, 1);
            }
        }
        this.setData({ bodyFatInput: value });
    },
    onNoteInput(e) {
        this.setData({ noteInput: e.detail.value });
    },
    async onSaveTap() {
        if (this.data.saving)
            return;
        const { weightInput, bodyFatInput, noteInput, selectedDate, selectedPeriod } = this.data;
        // 校验
        const trimmedWeight = weightInput.trim();
        if (!trimmedWeight) {
            this.setData({ errorMsg: '请输入体重' });
            return;
        }
        // 严格的体重格式：数字 + 可选一位小数
        if (!/^\d{1,3}(\.\d)?$/.test(trimmedWeight)) {
            this.setData({ errorMsg: '体重格式不正确，请输入如 65.5 的格式' });
            return;
        }
        const weight = parseFloat(trimmedWeight);
        if (isNaN(weight) || !isFinite(weight)) {
            this.setData({ errorMsg: '体重数值格式不正确' });
            return;
        }
        if (weight < 20 || weight > 300) {
            this.setData({ errorMsg: '体重需在 20.0~300.0 kg 范围内' });
            return;
        }
        // 体脂率（可选）
        const trimmedBodyFat = bodyFatInput.trim();
        let bodyFat = undefined;
        if (trimmedBodyFat) {
            if (!/^\d{1,2}(\.\d)?$/.test(trimmedBodyFat)) {
                this.setData({ errorMsg: '体脂率格式不正确，请输入如 22.5 的格式' });
                return;
            }
            bodyFat = parseFloat(trimmedBodyFat);
            if (isNaN(bodyFat) || !isFinite(bodyFat) || bodyFat <= 0 || bodyFat > 75) {
                this.setData({ errorMsg: '体脂率需在 0~75% 范围内' });
                return;
            }
        }
        if (noteInput.length > 200) {
            this.setData({ errorMsg: '备注最多200字符' });
            return;
        }
        this.setData({ errorMsg: '', saving: true });
        try {
            await (0, api_1.createWeightRecord)({
                date: selectedDate,
                period: selectedPeriod,
                weight: weight,
                bodyFat: bodyFat,
                note: noteInput.trim() || undefined,
            });
            this.setData({ saving: false });
            wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
            wx.switchTab({ url: '/pages/home/index' });
        }
        catch (e) {
            console.error('save error:', e);
            this.setData({
                saving: false,
                errorMsg: '保存失败，请重试',
            });
        }
    },
});
