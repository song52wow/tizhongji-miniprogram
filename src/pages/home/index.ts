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

      // 提取早晨和晚间数据，保留日期信息用于统一日期轴对齐
      const morningRecs = records
        .filter((r: any) => r.period === 'morning')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      const eveningRecs = records
        .filter((r: any) => r.period === 'evening')
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      const morningSeries = morningRecs.map((r: any) => r.weight);
      const eveningSeries = eveningRecs.map((r: any) => r.weight);

      // 建立统一日期轴
      const allDates = [...new Set(records.map((r: any) => r.date))].sort() as string[];
      const dateMap = new Map(allDates.map((d, i) => [d, i]));

      this.setData({ chartLineData: morningSeries });

      setTimeout(() => {
        this.drawSparkline(morningRecs, eveningRecs, allDates, dateMap);
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

  drawSparkline(morningRecs: any[], eveningRecs: any[], allDates: string[], dateMap: Map<string, number>) {
    // 建立统一日期轴对齐数据：按日期映射权重，无数据处为 null
    const alignedMorning: (number | null)[] = allDates.map(
      d => morningRecs.find((r: any) => r.date === d)?.weight ?? null
    );
    const alignedEvening: (number | null)[] = allDates.map(
      d => eveningRecs.find((r: any) => r.date === d)?.weight ?? null
    );

    const hasMorning = alignedMorning.some(v => v !== null);
    const hasEvening = alignedEvening.some(v => v !== null);
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
      const height = 168;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      // 合并数据计算 Y 轴范围（只计算有效值）
      const allWeights = [...alignedMorning.filter(v => v !== null) as number[], ...alignedEvening.filter(v => v !== null) as number[]];
      const minVal = Math.min(...allWeights) - 2;
      const maxVal = Math.max(...allWeights) + 2;
      const range = maxVal - minVal || 1;

      const padding = 16;
      const chartW = width - padding * 2;
      const chartH = height - 24;
      const n = allDates.length;

      const getXAligned = (i: number) =>
        padding + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
      const getY = (v: number) =>
        chartH - ((v - minVal) / range) * (chartH - 20) + 10;

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

  onChartLongPress() {
    wx.switchTab({
      url: '/pages/trend/index',
    });
  },
});
