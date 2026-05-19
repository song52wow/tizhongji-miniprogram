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

      // 处理图表数据 — 保留日期信息用于统一日期轴对齐
      const morningRecs = records
        .filter((r: any) => r.period === 'morning')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      const eveningRecs = records
        .filter((r: any) => r.period === 'evening')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const morningData = morningRecs.map((r: any) => r.weight);
      const eveningData = eveningRecs.map((r: any) => r.weight);

      // 建立统一日期轴
      const allDates = [...new Set(records.map((r: any) => r.date))].sort() as string[];

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
        this.drawTrendChart(morningData, eveningData, morningRecs, eveningRecs, allDates);
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

  drawTrendChart(morningData: number[], eveningData: number[], morningRecs: any[], eveningRecs: any[], allDates: string[]) {
    // 建立统一日期轴对齐数据
    const alignedMorning: (number | null)[] = allDates.map(
      d => morningRecs.find((r: any) => r.date === d)?.weight ?? null
    );
    const alignedEvening: (number | null)[] = allDates.map(
      d => eveningRecs.find((r: any) => r.date === d)?.weight ?? null
    );

    if (morningData.length === 0 && eveningData.length === 0) {
      this.setData({ chartReady: true });
      return;
    }

    const allWeights = [...alignedMorning.filter(v => v !== null) as number[], ...alignedEvening.filter(v => v !== null) as number[]];
    if (allWeights.length === 0) {
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
      const height = 178;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const minVal = Math.min(...allWeights) - 1;
      const maxVal = Math.max(...allWeights) + 1;
      const range = maxVal - minVal || 1;

      const padding = 8;
      const labelW = 30;
      const chartW = width - padding - labelW;
      const chartH = height - 32;
      const chartX = padding + labelW;
      const chartY = 10;
      const n = allDates.length;

      // Draw horizontal grid lines and Y-axis labels
      const gridCount = 4;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#5F6871';
      for (let g = 0; g <= gridCount; g++) {
        const y = chartY + chartH - (g / gridCount) * chartH;
        const val = minVal + (g / gridCount) * range;
        // Grid line
        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#DCE5DC';
        ctx.lineWidth = 1;
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartW, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Y-axis label
        ctx.fillText(val.toFixed(1), padding, y + 3);
      }

      // Y-axis label unit
      ctx.fillStyle = '#5F6871';
      ctx.font = '9px sans-serif';
      ctx.fillText('kg', padding, chartY + 10);

      const getY = (v: number) =>
        chartY + chartH - ((v - minVal) / range) * chartH;

      // 使用统一日期轴计算X坐标
      const getXAligned = (i: number) =>
        chartX + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);

      const buildPoints = (data: (number | null)[]) => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < data.length; i++) {
          if (data[i] !== null) {
            pts.push({ x: getXAligned(i), y: getY(data[i]!) });
          }
        }
        return pts;
      };

      const drawLine = (alignedData: (number | null)[], color: string, fillAlpha: number) => {
        const points = buildPoints(alignedData);
        if (points.length === 0) return;

        // 区域填充
        ctx.beginPath();
        ctx.moveTo(points[0].x, chartY + chartH);
        for (const p of points) {
          ctx.lineTo(p.x, p.y);
        }
        ctx.lineTo(points[points.length - 1].x, chartY + chartH);
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

  onChartTouch() {
    // 触摸图表时可以添加交互
  },
});
