import { getWeightRecords } from '../../services/api';

Page({
  data: {
    loading: false,
    dateLabel: '',

    morningWeight: null as number | null,
    morningTime: '--:--',
    morningChange: '暂无对比数据',

    eveningWeight: null as number | null,
    eveningTime: '--:--',
    eveningChange: '暂无对比数据',

    chartReady: false,
    dateRangeStart: '',
    chartLineData: [] as number[],
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });

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
      const records = await getWeightRecords({
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
        morningWeight: morningRec?.weight ?? null,
        morningTime: morningRec ? this.formatTime(new Date(morningRec.createdAt)) : '--:--',
        morningChange: morningChangeText,
        eveningWeight: eveningRec?.weight ?? null,
        eveningTime: eveningRec ? this.formatTime(new Date(eveningRec.createdAt)) : '--:--',
        eveningChange: eveningChangeText,
        dateRangeStart: `${weekAgoDate.getMonth() + 1}/${weekAgoDate.getDate()}`,
      });

      // 提取早晨数据用于图表
      const morningSeries = records
        .filter((r) => r.period === 'morning')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => r.weight);
      const eveningSeries = records
        .filter((r) => r.period === 'evening')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => r.weight);

      this.setData({ chartLineData: morningSeries });

      setTimeout(() => {
        this.drawSparkline(morningSeries, eveningSeries);
      }, 100);

    } catch (e) {
      console.error('loadData error:', e);
      this.setData({ loading: false });
    }
  },

  getTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  getDaysAgoStr(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },

  isConsecutiveDay(date1: string, date2: string): boolean {
    const [y1, m1, d1] = date1.split('-').map(Number);
    const [y2, m2, d2] = date2.split('-').map(Number);
    const d1Date = new Date(y1, m1 - 1, d1);
    const d2Date = new Date(y2, m2 - 1, d2);
    const diffMs = d1Date.getTime() - d2Date.getTime();
    return diffMs === 86400000; // 1 day in ms
  },

  drawSparkline(morningData: number[], eveningData: number[]) {
    const hasMorning = morningData && morningData.length > 0;
    const hasEvening = eveningData && eveningData.length > 0;
    if (!hasMorning && !hasEvening) {
      this.setData({ chartReady: true });
      return;
    }

    const query = wx.createSelectorQuery();
    query.select('.chart-canvas').node((res: any) => {
      if (!res || !res.node) {
        this.setData({ chartReady: true });
        return;
      }

      const canvas = res.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      const width = 335;
      const height = 140;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      // 合并数据计算 Y 轴范围
      const allData = [...(morningData || []), ...(eveningData || [])];
      const minVal = Math.min(...allData) - 2;
      const maxVal = Math.max(...allData) + 2;
      const range = maxVal - minVal || 1;

      const padding = 16;
      const chartW = width - padding * 2;
      const chartH = height - 16;

      const getX = (i: number, total: number) =>
        padding + (total <= 1 ? chartW / 2 : (i / (total - 1)) * chartW);
      const getY = (v: number) =>
        chartH - ((v - minVal) / range) * (chartH - 20) + 10;

      // Align both series to same X positions to avoid date misalignment
      const maxLen = Math.max((morningData || []).length, (eveningData || []).length);
      const getXAligned = (i: number) =>
        padding + (maxLen <= 1 ? chartW / 2 : (i / (maxLen - 1)) * chartW);

      const drawLine = (data: number[], color: string, fillAlpha: number) => {
        if (data.length === 0) return;

        // 区域填充（平滑曲线）
        ctx.beginPath();
        ctx.moveTo(getXAligned(0), chartH);
        if (data.length === 1) {
          ctx.lineTo(getXAligned(0), getY(data[0]));
        } else {
          for (let i = 0; i < data.length; i++) {
            const x = getXAligned(i);
            const y = getY(data[i]);
            if (i === 0) {
              ctx.lineTo(x, y);
            } else {
              const prevX = getXAligned(i - 1);
              const prevY = getY(data[i - 1]);
              const cpX = (prevX + x) / 2;
              const cpY = prevY;
              ctx.quadraticCurveTo(cpX, cpY, (prevX + x) / 2, (prevY + y) / 2);
              ctx.quadraticCurveTo(x, y, x, y);
            }
          }
        }
        ctx.lineTo(getXAligned(data.length - 1), chartH);
        ctx.closePath();
        ctx.fillStyle = color + Math.round(fillAlpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // 平滑折线
        ctx.beginPath();
        if (data.length === 1) {
          ctx.arc(getXAligned(0), getY(data[0]), 1, 0, Math.PI * 2);
        } else {
          ctx.moveTo(getXAligned(0), getY(data[0]));
          for (let i = 1; i < data.length; i++) {
            const prevX = getXAligned(i - 1);
            const prevY = getY(data[i - 1]);
            const x = getXAligned(i);
            const y = getY(data[i]);
            const cpX = (prevX + x) / 2;
            ctx.quadraticCurveTo(cpX, prevY, cpX, (prevY + y) / 2);
            ctx.quadraticCurveTo(x, y, x, y);
          }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 数据点
        for (let i = 0; i < data.length; i++) {
          ctx.beginPath();
          ctx.arc(getXAligned(i), getY(data[i]), 5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      };

      // 早晨线（橙色）画在底层，晚间线（紫色）画在上层
      drawLine(morningData || [], '#FC8A40', 0.08);
      drawLine(eveningData || [], '#9984FF', 0.08);

      this.setData({ chartReady: true });
    }).exec();
  },

  onAddTap() {
    wx.navigateTo({
      url: '/pages/record/index',
    });
  },

  onChartLongPress() {
    wx.switchTab({
      url: '/pages/trend/index',
    });
  },
});