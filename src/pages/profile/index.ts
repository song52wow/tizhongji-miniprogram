import { getProfile, updateProfile } from '../../services/api';

interface ProfilePageData {
  loading: boolean;
  saving: boolean;
  errorMsg: string;
  heightInput: string;
  savedHeight: number | null;
}

Page({
  data: {
    loading: false,
    saving: false,
    errorMsg: '',
    heightInput: '',
    savedHeight: null as number | null,
  } as ProfilePageData,

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({ loading: true, errorMsg: '' });
    try {
      const profile = await getProfile();
      const height = profile.height;
      this.setData({
        loading: false,
        savedHeight: height,
        heightInput: height !== null && height !== undefined ? String(height) : '',
      });
      if (height !== null && height !== undefined) {
        wx.setStorageSync('userHeight', height);
      }
    } catch (e: any) {
      console.error('loadProfile error:', e);
      // 回退：使用本地缓存的身高
      const cached = wx.getStorageSync('userHeight');
      this.setData({
        loading: false,
        savedHeight: typeof cached === 'number' ? cached : null,
        heightInput: typeof cached === 'number' ? String(cached) : '',
      });
    }
  },

  onHeightInput(e: any) {
    let value = e.detail.value;
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts[1].length > 1) {
        value = parts[0] + '.' + parts[1].slice(0, 1);
      }
    }
    this.setData({ heightInput: value });
  },

  async onSaveTap() {
    if (this.data.saving) return;

    const trimmed = this.data.heightInput.trim();
    if (!trimmed) {
      this.setData({ errorMsg: '请输入身高' });
      return;
    }
    if (!/^\d{2,3}(\.\d)?$/.test(trimmed)) {
      this.setData({ errorMsg: '身高格式不正确，请输入如 175 的格式（cm）' });
      return;
    }
    const height = parseFloat(trimmed);
    if (isNaN(height) || !isFinite(height)) {
      this.setData({ errorMsg: '身高数值格式不正确' });
      return;
    }
    if (height < 50 || height > 250) {
      this.setData({ errorMsg: '身高需在 50~250 cm 范围内' });
      return;
    }

    this.setData({ errorMsg: '', saving: true });
    try {
      const result = await updateProfile(height);
      const saved = result.height ?? height;
      wx.setStorageSync('userHeight', saved);
      this.setData({ saving: false, savedHeight: saved });
      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
    } catch (e: any) {
      console.error('save profile error:', e);
      this.setData({ saving: false, errorMsg: '保存失败，请重试' });
    }
  },
});
