import { getWeightRecords, createWeightRecord } from '../../services/api';

interface RecordPageData {
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  dateDisplay: string;
  selectedDate: string;
  maxDate: string;
  selectedPeriod: 'morning' | 'evening';
  weightInput: string;
  noteInput: string;
  existingRecord: any;
}

Page({
  data: {
    loading: false,
    saving: false,
    errorMsg: '',
    dateDisplay: '',
    selectedDate: '',
    maxDate: '',
    selectedPeriod: 'morning' as 'morning' | 'evening',
    weightInput: '',
    noteInput: '',
    existingRecord: null as any,
  } as RecordPageData,

  onLoad(options: any) {
    const dateFromOptions = options.date;
    const periodFromOptions = options.period;
    let selectedDate: string;
    let displayParts: [number, number, number];

    if (dateFromOptions) {
      selectedDate = dateFromOptions;
      const [y, m, d] = dateFromOptions.split('-').map(Number);
      displayParts = [d, m, y];
    } else {
      const today = new Date();
      selectedDate = this.formatDateForApi(today);
      displayParts = [today.getDate(), today.getMonth() + 1, today.getFullYear()];
    }

    const selectedPeriod: 'morning' | 'evening' = periodFromOptions === 'evening' ? 'evening' : 'morning';

    this.setData({
      selectedDate,
      dateDisplay: `${displayParts[0]}/${displayParts[1]}/${displayParts[2]}`,
      maxDate: this.formatDateForApi(new Date()),
      selectedPeriod,
    });
    this.loadExistingRecord();
  },

  onShow() {
    this.loadExistingRecord();
  },

  formatDateForApi(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  async loadExistingRecord() {
    const { selectedDate, selectedPeriod } = this.data;
    this.setData({ loading: true, errorMsg: '' });

    try {
      const records = await getWeightRecords({
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
          noteInput: rec.note || '',
          selectedPeriod: rec.period,
        });
      } else {
        this.setData({
          loading: false,
          existingRecord: null,
          weightInput: '',
          noteInput: '',
        });
      }
    } catch (e: any) {
      console.error('loadExistingRecord error:', e);
      this.setData({ loading: false });
    }
  },

  onDateChange(e: any) {
    const val = e.detail.value;
    if (!val) return;
    const [y, m, d] = val.split('-').map(Number);
    this.setData({
      selectedDate: val,
      dateDisplay: `${d}/${m}/${y}`,
      existingRecord: null,
      weightInput: '',
      noteInput: '',
    });
    this.loadExistingRecord();
  },

  onPeriodChange(e: any) {
    const period = e.currentTarget.dataset.period;
    if (period === this.data.selectedPeriod) return;

    this.setData({
      selectedPeriod: period,
      existingRecord: null,
      weightInput: '',
      noteInput: '',
      loading: true,
    });
    this.loadExistingRecord();
  },

  onWeightInput(e: any) {
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
  },

  onNoteInput(e: any) {
    this.setData({ noteInput: e.detail.value });
  },

  async onSaveTap() {
    if (this.data.saving) return;

    const { weightInput, noteInput, selectedDate, selectedPeriod } = this.data;

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

    if (noteInput.length > 200) {
      this.setData({ errorMsg: '备注最多200字符' });
      return;
    }

    this.setData({ errorMsg: '', saving: true });

    try {
      await createWeightRecord({
        date: selectedDate,
        period: selectedPeriod,
        weight: weight,
        note: noteInput.trim() || undefined,
      });

      wx.navigateBack();
    } catch (e: any) {
      console.error('save error:', e);
      this.setData({
        saving: false,
        errorMsg: '保存失败，请重试',
      });
    }
  },
});
