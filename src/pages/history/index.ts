import { getWeightRecords, deleteWeightRecord } from '../../services/api';

interface DisplayRecord {
  id: string;
  date: string;
  dateLabel: string;
  period: 'morning' | 'evening';
  weight: string;
  note?: string;
}

Page({
  data: {
    activeTab: 0,
    loading: false,
    loadingMore: false,
    page: 1,
    pageSize: 30,
    hasMore: true,
    records: [] as DisplayRecord[],
  },

  onLoad() {
    this.loadRecords();
  },

  onShow() {
    // 从编辑页返回时刷新
    this.setData({ page: 1 });
    this.loadRecords();
  },

  async loadRecords() {
    this.setData({ loading: true });
    try {
      const records = await getWeightRecords({
        page: 1,
        pageSize: this.data.pageSize,
      });

      const displayRecords = this.formatRecordsForDisplay(records);

      this.setData({
        records: displayRecords,
        page: 1,
        hasMore: records.length >= this.data.pageSize,
        loading: false,
      });
    } catch (e) {
      console.error('loadRecords error:', e);
      this.setData({ loading: false });
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;

    this.setData({ loadingMore: true });
    const nextPage = this.data.page + 1;

    try {
      const records = await getWeightRecords({
        page: nextPage,
        pageSize: this.data.pageSize,
      });

      const displayRecords = this.formatRecordsForDisplay(records);

      this.setData({
        records: [...this.data.records, ...displayRecords],
        page: nextPage,
        hasMore: records.length >= this.data.pageSize,
        loadingMore: false,
      });
    } catch (e) {
      console.error('loadMore error:', e);
      this.setData({ loadingMore: false });
    }
  },

  formatRecordsForDisplay(records: any[]): DisplayRecord[] {
    return records.map((r) => {
      const dateParts = r.date.split('-').map(Number);
      const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      return {
        id: r.id,
        date: r.date,
        dateLabel: `${date.getMonth() + 1}月${date.getDate()}日`,
        period: r.period,
        weight: r.weight.toFixed(1),
        note: r.note,
      };
    });
  },

  onTabChange(e: any) {
    this.setData({ activeTab: parseInt(e.currentTarget.dataset.tab) });
  },

  onRecordTap(e: any) {
    const record = e.currentTarget.dataset.record;
    wx.navigateTo({
      url: `/pages/record/index?date=${record.date}&period=${record.period}`,
    });
  },

  onRecordLongPress(e: any) {
    const record = e.currentTarget.dataset.record;
    const index = e.currentTarget.dataset.recordindex;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条体重记录吗？',
      success: async (res: any) => {
        if (res.confirm) {
          try {
            await deleteWeightRecord(record.id);
            // Remove from list
            const records = [...this.data.records];
            records.splice(index, 1);
            this.setData({ records });
          } catch (e) {
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          }
        }
      },
    });
  },
});