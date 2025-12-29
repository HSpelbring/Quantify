import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FundService } from '../../services/fund.service';
import { Chart, registerables } from 'chart.js';
import { Subject, Subscription, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { InsiderTradingComponent } from '../../components/insider-trading/insider-trading.component';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-lookup',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, InsiderTradingComponent],
  templateUrl: './lookup.component.html',
  styleUrls: ['./lookup.component.css']
})
export class LookupComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('stockChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  fundService = inject(FundService);
  cdr = inject(ChangeDetectorRef);
  chart: Chart | null = null;

  query = '';
  previous: string[] = [];
  timeframes = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
  indicators = ['50MA', '200MA', 'VWAP']; // Placeholders
  activeTF = '1D';

  // ... (existing code)

  getConsensusClass(consensus: string): string {
    if (!consensus) return '';
    const c = consensus.toLowerCase();
    if (c.includes('strong buy')) return 'strong-buy';
    if (c.includes('strong sell')) return 'strong-sell';
    if (c.includes('buy')) return 'buy';
    if (c.includes('sell')) return 'sell';
    if (c.includes('hold')) return 'hold';
    return '';
  }

  getTargetPriceColor(): string {
    const currentPrice = this.details.price;
    const targetPrice = this.companyInfo.targetPrice;

    if (!currentPrice || !targetPrice || currentPrice === 0) {
      return '#888'; // Gray if no data
    }

    const percentDiff = ((targetPrice - currentPrice) / currentPrice) * 100;

    if (percentDiff > 20) return '#2e7d32'; // Dark green
    if (percentDiff > 0) return '#4caf50'; // Green
    if (percentDiff === 0) return '#888'; // Gray (neutral)
    if (percentDiff > -20) return '#ef5350'; // Red
    return '#c62828'; // Dark red
  }

  periodChange = 0;
  periodChangePercent = 0;
  loading = false;
  error = '';

  searchResults: any[] = [];
  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  details: any = {
    symbol: '-',
    name: '-',
    price: 0,
    change: 0,
    changePercent: 0,
    dayRange: '-',
    yearRange: '-',
    marketCap: '-',
    volume: '-',
    avgVolume: '-',
    pe: '-',
    eps: '-',
    high: '-',
    low: '-',
    open: '-',
    prevClose: '-'
  };

  companyInfo: any = {
    sector: '-',
    industry: '-',
    employees: 0,
    description: '-',
    website: '',
    country: '-',
    city: '-',
    targetPrice: 0,
    recommendations: {
      consensus: 'N/A',
      strongBuy: 0,
      buy: 0,
      hold: 0,
      sell: 0,
      strongSell: 0
    }
  };

  isDescriptionExpanded = false;

  watchlist: any[] = [];
  watchlistSymbols = ['AAPL', 'NVDA', 'MSFT', 'AMD']; // Default symbols

  // ... (history) ...

  isPositive(val: string): boolean {
    if (!val) return false;
    return val.includes('+') || (!val.includes('-') && parseFloat(val.replace(/[^0-9.-]/g, '')) > 0);
  }

  loadWatchlistData() {
    this.watchlist = [];
    this.watchlistSymbols.forEach(sym => {
      this.fundService.getFundSimple(sym).subscribe({
        next: (data) => {
          if (!data || data.error) return;
          // Add to watchlist array
          this.watchlist.push({
            symbol: data.symbol,
            price: data.price,
            change: data.change,
            changePercent: data.changePercent
          });
        },
        error: (e) => console.error(`Failed to load watchlist item ${sym}`, e)
      });
    });
  }

  // ... (existing code) ...

  // Placeholder for Upcoming Events with logic
  upcomingEvents = [
    { label: 'Earnings', dateStr: 'Oct 24, 2025', days: 0, colorClass: '' },
    { label: 'Dividend', dateStr: 'Nov 14, 2025', days: 0, colorClass: '' },
    { label: 'Ex-Div Date', dateStr: 'Nov 10, 2025', days: 0, colorClass: '' }
  ];

  updateEventProximity() {
    // Mock logic: randomly assign days or parse dates if they were real
    // For demo stability, I'll hardcode some variety to show the color rules
    this.upcomingEvents = [
      { label: 'Earnings', dateStr: 'Oct 24, 2025', days: 2, colorClass: 'proximity-red' }, // < 3 days
      { label: 'Dividend', dateStr: 'Nov 14, 2025', days: 9, colorClass: 'proximity-gray' }, // > 7 days
      { label: 'Ex-Div Date', dateStr: 'Nov 10, 2025', days: 5, colorClass: 'proximity-amber' } // 3-7 days
    ];
  }

  // Ranges Logic
  getRangePosition(rangeStr: string): number {
    if (!rangeStr) return 50;
    // Split by hyphen or en-dash
    const parts = rangeStr.split(/[-–]/).map(s => parseFloat(s.trim().replace(/,/g, '')));

    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 50;

    const min = parts[0];
    const max = parts[1];
    const current = this.details.price;

    if (max === min) return 50;
    let pct = ((current - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, pct)); // Clamp 0-100
  }

  getRangeMin(rangeStr: string): string {
    if (!rangeStr) return '-';
    const parts = rangeStr.split(/[-–]/);
    return parts.length > 0 ? parts[0].trim() : '-';
  }

  getRangeMax(rangeStr: string): string {
    if (!rangeStr) return '-';
    const parts = rangeStr.split(/[-–]/);
    return parts.length > 1 ? parts[1].trim() : '-';
  }

  fakeFundamentals = {
    revenue: '$96.77B',
    yoy: '+5.2%',
    margins: '42.3%'
  };

  newsSentiment = {
    label: 'Bullish',
    score: 72,
    headlines: [
      'Analyst upgrades target price to $240',
      'New product line breaks sales records',
      'Supply chain issues resolved ahead of schedule'
    ]
  };

  onSearch() {
    if (!this.query.trim()) return;

    const symbol = this.query.toUpperCase();
    localStorage.setItem('lastViewedSymbol', symbol);

    // Remove symbol if it already exists (to avoid duplicates)
    const existingIndex = this.previous.indexOf(symbol);
    if (existingIndex > -1) {
      this.previous.splice(existingIndex, 1);
    }

    // Add to beginning of array
    this.previous.unshift(symbol);

    // Limit to 3 recent searches
    if (this.previous.length > 3) {
      this.previous = this.previous.slice(0, 3);
    }

    this.loading = true;
    this.error = '';

    this.fundService.getStockDetails(symbol).subscribe({
      next: (data) => {
        if (data.error) {
          this.error = `Failed to fetch data for ${symbol}`;
          this.loading = false;
          return;
        }

        // Update details with real data
        this.details = {
          symbol: data.symbol || symbol,
          name: data.name || symbol,
          price: data.price || 0,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          dayRange: data.dayLow && data.dayHigh ? `${this.formatNumber(data.dayLow)} – ${this.formatNumber(data.dayHigh)}` : '—',
          yearRange: data.fiftyTwoWeekLow && data.fiftyTwoWeekHigh ? `${this.formatNumber(data.fiftyTwoWeekLow)} – ${this.formatNumber(data.fiftyTwoWeekHigh)}` : '—',
          marketCap: this.formatMarketCap(data.marketCap),
          volume: this.formatVolume(data.volume),
          avgVolume: this.formatVolume(data.averageVolume),
          pe: data.trailingPE ? this.formatNumber(data.trailingPE) : '—',
          eps: data.trailingEps ? this.formatNumber(data.trailingEps) : '—',
          high: data.dayHigh ? this.formatNumber(data.dayHigh) : '—',
          low: data.dayLow ? this.formatNumber(data.dayLow) : '—',
          open: data.open ? this.formatNumber(data.open) : '—',
          prevClose: data.previousClose ? this.formatNumber(data.previousClose) : '—',
          beta: data.beta ? data.beta.toFixed(2) : '—'
        };

        // Update real fundamentals
        this.fakeFundamentals = {
          revenue: this.formatMarketCap(data.totalRevenue), // Using market cap formatter for large numbers
          yoy: data.revenueGrowth ? (data.revenueGrowth * 100).toFixed(2) + '%' : '-',
          margins: data.grossMargins ? (data.grossMargins * 100).toFixed(2) + '%' : '-'
        };

        // Update upcoming events with real data
        const events = [];

        if (data.earningsTimestamp || data.earningsTimestampStart) {
          const ts = data.earningsTimestamp || data.earningsTimestampStart;
          events.push({ label: 'Earnings', date: new Date(ts * 1000) });
        }
        if (data.exDividendDate) {
          events.push({ label: 'Ex-Div Date', date: new Date(data.exDividendDate * 1000) });
        }
        if (data.dividendDate) {
          events.push({ label: 'Dividend', date: new Date(data.dividendDate * 1000) });
        }

        // Process events to add proximity logic
        const now = new Date();
        this.upcomingEvents = events.map(e => {
          const diffTime = e.date.getTime() - now.getTime();
          const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let colorClass = 'proximity-gray';
          if (days < 3 && days >= 0) colorClass = 'proximity-red';
          else if (days >= 3 && days <= 7) colorClass = 'proximity-amber';

          // Format date string
          const dateStr = e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

          return {
            label: e.label,
            dateStr: dateStr,
            days: days,
            colorClass: colorClass,
            rawDate: e.date // for sorting
          };
        })
          .sort((a, b) => {
            // Sort by Date Descending (Newest first)
            return b.rawDate.getTime() - a.rawDate.getTime();
          });
        // Removed slice to show all relevant events up to a reasonable limit, or maybe stick to 4?
        // User implied they want to see them. Let's keep slice(0, 4) for UI balance but ensure we pick the "best" 4.
        // Actually, for "Upcoming", maybe we prefer Future?
        // But user wants to see "Splits" which are often past.
        // Mixed approach: Sort by date descending puts Newest (Future) and Recent Past at top. That works.
        this.upcomingEvents = this.upcomingEvents.slice(0, 4);

        if (this.upcomingEvents.length === 0) {
          // Fallback if no real events found
          this.upcomingEvents = [
            { label: 'No Events', dateStr: '-', days: 0, colorClass: '' }
          ];
        }

        // Update company info
        this.companyInfo = {
          sector: data.sector || 'N/A',
          industry: data.industry || 'N/A',
          employees: data.fullTimeEmployees || 0,
          description: data.description || 'No description available',
          website: data.website || '',
          country: data.country || 'N/A',
          city: data.city || 'N/A',
          targetPrice: data.targetMeanPrice || 0,
          recommendations: data.recommendations || {
            consensus: 'N/A',
            strongBuy: 0,
            buy: 0,
            hold: 0,
            sell: 0,
            strongSell: 0
          }
        };

        this.loading = false;

        // Force view update so *ngIf renders the canvas
        this.cdr.detectChanges();

        // Destroy previous chart to ensure clean state for new symbol
        this.destroyChart();

        // Initialize chart if it doesn't exist (it shouldn't after destroy)
        this.initializeChart();

        // Also fetch history for the current timeframe
        this.loadHistory(symbol, this.activeTF);
      },
      error: (err) => {
        console.error('Error fetching stock details:', err);
        this.error = `Failed to fetch data for ${symbol}`;
        this.loading = false;
      }
    });
  }

  changeTimeframe(tf: string) {
    // Always reload, even if same timeframe (allows refresh)
    this.activeTF = tf;
    this.cachedHistoryData = []; // Clear cache so we don't render stale data while loading
    if (this.details.symbol && this.details.symbol !== '-') {
      this.loading = true; // Show loading spinner or similar if needed? User didn't ask for spinner on graph but implied data "doesn't load".
      this.loadHistory(this.details.symbol, tf);
    }
  }

  loadHistory(symbol: string, timeframe: string) {
    this.fundService.getStockHistory(symbol, timeframe).subscribe({
      next: (data) => {
        if (data.error) {
          console.error('Error loading history:', data.error);
          this.loading = false; // Stop spinner
          return;
        }
        // Update chart with historical data
        if (data.data && data.data.length > 0) {
          this.updateChart(data.data);

          // Calculate Period Change
          const prices = data.data.map((d: any) => d.close);
          if (prices.length > 0) {
            const startPrice = prices[0];
            const endPrice = prices[prices.length - 1];

            this.periodChange = endPrice - startPrice;
            this.periodChangePercent = ((endPrice - startPrice) / startPrice) * 100;
          } else {
            this.periodChange = 0;
            this.periodChangePercent = 0;
          }
        }

        // Always stop loading, whether data exists or not
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching history:', err);
        this.loading = false; // Stop spinner on error
      }
    });
  }

  formatNumber(num: number): string {
    if (!num) return '0';
    return num.toFixed(2);
  }

  formatMarketCap(cap: number): string {
    if (!cap) return '—';
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `${(cap / 1e6).toFixed(2)}M`;
    return cap.toString();
  }

  formatVolume(vol: number): string {
    if (!vol) return '—';
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
    return vol.toString();
  }

  marketStatus = 'Closed';
  isMarketOpen = false;

  getVolumeStatus(): string {
    return 'High';
  }

  checkMarketStatus() {
    const now = new Date();
    const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const estDate = new Date(estString);

    const day = estDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = estDate.getHours();
    const minute = estDate.getMinutes();

    const isWeekday = day >= 1 && day <= 5;
    const isAfterOpen = (hour > 9) || (hour === 9 && minute >= 30);
    const isBeforeClose = (hour < 16);

    if (isWeekday && isAfterOpen && isBeforeClose) {
      this.marketStatus = 'Open';
      this.isMarketOpen = true;
    } else {
      this.marketStatus = 'Closed';
      this.isMarketOpen = false;
    }
  }

  selectPrevious(symbol: string) {
    this.query = symbol;
    this.onSearch();
  }

  isInWatchlist(): boolean {
    return this.watchlist.some(w => w.symbol === this.details.symbol);
  }

  toggleWatchlist() {
    if (!this.details.symbol) return;

    if (this.isInWatchlist()) {
      this.removeFromWatchlist(this.details.symbol);
    } else {
      // Add to watchlist
      this.watchlist.push({
        symbol: this.details.symbol,
        price: this.details.price,
        change: this.details.change,
        changePercent: this.details.changePercent
      });
    }
  }

  removeFromWatchlist(symbol: string) {
    const index = this.watchlist.findIndex(w => w.symbol === symbol);
    if (index > -1) {
      this.watchlist.splice(index, 1);
    }
  }

  ngAfterViewInit() {
    this.initializeChart();
  }

  initializeChart(labels: string[] = [], data: number[] = []) {
    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Price',
          data: data,
          borderColor: '#4caf50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#4caf50',
            borderWidth: 1,
            callbacks: {
              label: function (context: any) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: '#333', display: true },
            ticks: { color: '#ccc', maxTicksLimit: 8 }
          },
          y: {
            grid: { color: '#333', display: true },
            ticks: {
              color: '#ccc',
              callback: function (value: any) {
                return '$' + parseFloat(value).toFixed(2);
              }
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }

  destroyChart() {
    // 1. Destroy via class reference
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    // 2. Safety Check: Destroy via DOM element (Chart.js registry)
    // This catches cases where this.chart might be null but a chart still exists on the canvas
    if (this.chartCanvas && this.chartCanvas.nativeElement) {
      const existingChart = Chart.getChart(this.chartCanvas.nativeElement);
      if (existingChart) {
        existingChart.destroy();
      }
    }
  }

  selectedIndicators: Set<string> = new Set();
  cachedHistoryData: any[] = []; // Store data to re-render without refetching

  toggleIndicator(ind: string) {
    if (this.selectedIndicators.has(ind)) {
      this.selectedIndicators.delete(ind);
    } else {
      this.selectedIndicators.add(ind);
    }
    this.updateChart(this.cachedHistoryData);
  }

  isIndicatorActive(ind: string): boolean {
    return this.selectedIndicators.has(ind);
  }

  updateChart(historyData: any[]) {
    // Error handling: if no data, don't break, just clear or return
    if (!historyData || historyData.length === 0) {
      if (this.chart) {
        this.chart.data.labels = [];
        this.chart.data.datasets = [];
        this.chart.update();
      }
      return;
    }

    this.cachedHistoryData = historyData;

    const labels = historyData.map(d => {
      const date = new Date(d.date);
      if (isNaN(date.getTime())) return d.date;

      if (this.activeTF === '1D') {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      } else if (this.activeTF === '1Y' || this.activeTF === '5Y' || this.activeTF === 'MAX') {
        // Show year for longer timeframes
        const month = date.toLocaleDateString([], { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear().toString().slice(-2);
        return `${month} ${day} '${year}`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    });

    const prices = historyData.map(d => d.close);

    // Main Dataset
    const datasets: any[] = [{
      label: 'Price',
      data: prices,
      borderColor: '#4caf50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 4
    }];

    // Indicators
    const mapIndicator = (arr: any[], key: string) => arr.map(d => (d[key] !== undefined && d[key] !== null) ? d[key] : null);

    if (this.selectedIndicators.has('50MA')) {
      datasets.push({
        label: '50 MA',
        data: mapIndicator(historyData, 'sma50'),
        borderColor: '#2196F3',
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0.1
      });
    }

    if (this.selectedIndicators.has('200MA')) {
      datasets.push({
        label: '200 MA',
        data: mapIndicator(historyData, 'sma200'),
        borderColor: '#FF9800',
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0.1
      });
    }

    if (this.selectedIndicators.has('VWAP')) {
      datasets.push({
        label: 'VWAP',
        data: mapIndicator(historyData, 'vwap'),
        borderColor: '#9C27B0',
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
        tension: 0.1
      });
    }

    // "Different Method": Update existing instance smoothness
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update(); // Standard update, no flicker
    } else {
      // Init only if needed
      if (!this.chartCanvas) return;
      const ctx = this.chartCanvas.nativeElement.getContext('2d');
      if (!ctx) return;

      this.chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: '#ccc' } },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#4caf50',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { color: '#333', display: true },
              ticks: { color: '#ccc', maxTicksLimit: 8 }
            },
            y: {
              grid: { color: '#333', display: true },
              ticks: { color: '#ccc' }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
          }
        }
      });
    }
  }

  toggleDescription() {
    this.isDescriptionExpanded = !this.isDescriptionExpanded;
  }

  ngOnInit() {
    this.checkMarketStatus();
    this.updateEventProximity();
    this.loadWatchlistData();

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) return timer(0).pipe(switchMap(() => []));
        return this.fundService.searchStocks(query);
      })
    ).subscribe(results => {
      this.searchResults = results;
    });

    const savedSymbol = localStorage.getItem('lastViewedSymbol');
    this.query = savedSymbol ? savedSymbol : 'NVDA';
    this.onSearch();
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onInput() {
    this.searchSubject.next(this.query);
  }

  selectResult(result: any) {
    this.query = result.symbol;
    this.searchResults = [];
    this.onSearch();
  }

  closeSearch() {
    setTimeout(() => {
      this.searchResults = [];
    }, 200);
  }
}
