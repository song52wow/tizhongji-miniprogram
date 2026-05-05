import { getWeightRecords, getWeightStats } from '../../services/api';

Page({
  data: {
    loading: false,
    selectedRangeIndex: 1,
    rangeLabels: ['7天', '30天', '90天', '全部'] as string[],

    // 图表数据
    chartReady: false,
    morningData: [] as number[],
    eveningData: [] as number[],

    // 统计数据
    avgMorningWeight: '--',
    avgEveningWeight: '--',
    changeDisplay: '--',
    changeDirection: '→',
    minWeight: '--',
    maxWeight: '--',
    minWeightDate: '',
    maxWeightDate: '',
    avgWeightDiff: '--',
    avgDiffSubtext: '暂无对比数据',
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, chartReady: false });

    const { rangeStart, rangeEnd } = this.getRangeDates();
    const today = this.getTodayStr();

    try {
      const [records, stats] = await Promise.all([
        getWeightRecords({
          startDate: rangeStart,
          endDate: today,
          pageSize: 200,
        }),
        getWeightStats({
          startDate: rangeStart,
          endDate: today,
        }),
      ]);

      // 处理图表数据
      const morningRecs = records
        .filter((r: any) => r.period === 'morning')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      const eveningRecs = records
        .filter((r: any) => r.period === 'evening')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const morningData = morningRecs.map((r: any) => r.weight);
      const eveningData = eveningRecs.map((r: any) => r.weight);

      // 统计卡片数据
      const fmt = (v: number | null) => v != null ? v.toFixed(1) : '--';

      const changeStr = stats.change != null
        ? `${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(1)}`
        : '--';
      const changeDir = stats.change != null
        ? (stats.change < 0 ? '↓' : '↑')
        : '→';

      // 最低/最高记录日期
      const minRec = records.length > 0
        ? [...records].sort((a: any, b: any) => a.weight - b.weight)[0]
        : null;
      const maxRec = records.length > 0
        ? [...records].sort((a: any, b: any) => b.weight - a.weight)[0]
        : null;

      this.setData({
        loading: false,
        morningData,
        eveningData,
        avgMorningWeight: fmt(stats.avgMorningWeight),
        avgEveningWeight: fmt(stats.avgEveningWeight),
        changeDisplay: changeStr,
        changeDirection: changeDir,
        minWeight: fmt(stats.minWeight),
        maxWeight: fmt(stats.maxWeight),
        minWeightDate: minRec ? this.formatDateLabel(minRec.date) : '',
        maxWeightDate: maxRec ? this.formatDateLabel(maxRec.date) : '',
        avgWeightDiff: fmt(stats.avgWeightDiff),
        avgDiffSubtext: stats.avgWeightDiff != null ? '处于健康波动范围内' : '暂无对比数据',
      });

      // 渲染图表
      setTimeout(() => {
        this.drawTrendChart(morningData, eveningData);
      }, 100);

    } catch (e) {
      console.error('loadData error:', e);
      this.setData({ loading: false });
    }
  },

  getRangeDates(): { rangeStart: string; rangeEnd: string } {
    const today = this.getTodayStr();
    const index = this.data.selectedRangeIndex;
    let days: number;

    switch (index) {
      case 0: days = 7; break;
      case 1: days = 30; break;
      case 2: days = 90; break;
      default: return { rangeStart: '2000-01-01', rangeEnd: today };
    }

    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      rangeStart: this.formatDateForApi(start),
      rangeEnd: today,
    };
  },

  onRangeChange(e: any) {
    const index = parseInt(e.currentTarget.dataset.index);
    if (index === this.data.selectedRangeIndex) return;
    this.setData({ selectedRangeIndex: index });
    this.loadData();
  },

  getTodayStr(): string {
    const d = new Date();
    return this.formatDateForApi(d);
  },

  formatDateForApi(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${m}月${d}日`;
  },

  drawTrendChart(morningData: number[], eveningData: number[]) {
    if (morningData.length === 0 && eveningData.length === 0) {
      this.setData({ chartReady: true });
      return;
    }

    const allData = [...morningData, ...eveningData];
    if (allData.length === 0) {
      this.setData({ chartReady: true });
      return;
    }

    const query = wx.createSelectorQuery();
    query.select('.trend-chart').node((res: any) => {
      if (!res) {
        this.setData({ chartReady: true });
        return;
      }

      const canvas = res.node;
      if (!canvas) {
        this.setData({ chartReady: true });
        return;
      }

      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      const width = 320;
      const height = 200;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const safeData = allData.length > 0 ? allData : [0];
      const minVal = Math.min(...safeData) - 1;
      const maxVal = Math.max(...safeData) + 1;
      const range = maxVal - minVal || 1;

      const padding = 8;
      const labelW = 30;
      const chartW = width - padding - labelW;
      const chartH = height - 32;
      const chartX = padding + labelW;
      const chartY = 10;

      // Draw horizontal grid lines and Y-axis labels
      const gridCount = 4;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#999';
      for (let g = 0; g <= gridCount; g++) {
        const y = chartY + chartH - (g / gridCount) * chartH;
        const val = minVal + (g / gridCount) * range;
        // Grid line
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 1;
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Y-axis label
        ctx.fillText(val.toFixed(1), padding, y + 3);
      }

      // Y-axis label unit
      ctx.fillStyle = '#666';
      ctx.font = '9px sans-serif';
      ctx.fillText('kg', padding, chartY + 10);

      const getX = (i: number, total: number) =>
        chartX + (total <= 1 ? chartW / 2 : (i / (total - 1)) * chartW);
      const getY = (v: number) =>
        chartY + chartH - ((v - minVal) / range) * chartH;

      // Use the date range from records to determine max X points
      // Collect all dates from morningData and eveningData (they share the same date index)
      // We align by using the max length between the two series for X positions
      const maxLen = Math.max(morningData.length, eveningData.length);
      const getXAligned = (i: number) =>
        chartX + (maxLen <= 1 ? chartW / 2 : (i / (maxLen - 1)) * chartW);

      const drawLine = (data: number[], color: string, fillAlpha: number) => {
        if (data.length === 0) return;

        // 区域填充（平滑曲线）
        ctx.beginPath();
        ctx.moveTo(getXAligned(0), chartY + chartH);
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
              ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
              ctx.quadraticCurveTo(x, y, x, y);
            }
          }
        }
        ctx.lineTo(getXAligned(data.length - 1), chartY + chartH);
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

      drawLine(morningData, '#FC8A40', 0.08);
      drawLine(eveningData, '#9984FF', 0.08);

      this.setData({ chartReady: true });
    }).exec();
  },

  onChartTouch() {
    // 触摸图表时可以添加交互
  },
});