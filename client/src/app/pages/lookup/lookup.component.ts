import { Component, inject, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FundService } from '../../services/fund.service';
import { Chart, registerables } from 'chart.js';
import { Subject, Subscription, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

// Register Chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-lookup',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
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
  activeTF = '1D';
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

  watchlist = [
    { symbol: 'AAPL', price: 212.54 },
    { symbol: 'NVDA', price: 131.20 },
    { symbol: 'MSFT', price: 415.33 },
    { symbol: 'AMD', price: 158.22 }
  ];

  history = [
    { symbol: 'AAPL', when: '2h ago' },
    { symbol: 'TSLA', when: 'Yesterday' },
    { symbol: 'SPY', when: '3d ago' }
  ];

  onSearch() {
    if (!this.query.trim()) return;

    const symbol = this.query.toUpperCase();

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
          prevClose: data.previousClose ? this.formatNumber(data.previousClose) : '—'
        };

        // Update company info
        this.companyInfo = {
          sector: data.sector || 'N/A',
          industry: data.industry || 'N/A',
          employees: data.fullTimeEmployees || 0,
          description: data.description || 'No description available',
          website: data.website || '',
          country: data.country || 'N/A',
          city: data.city || 'N/A',
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
    this.activeTF = tf;
    if (this.details.symbol && this.details.symbol !== '-') {
      this.loadHistory(this.details.symbol, tf);
    }
  }

  loadHistory(symbol: string, timeframe: string) {
    this.fundService.getStockHistory(symbol, timeframe).subscribe({
      next: (data) => {
        if (data.error) {
          console.error('Error loading history:', data.error);
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
      },
      error: (err) => {
        console.error('Error fetching history:', err);
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
        price: this.details.price
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

    // Destroy existing chart if any
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
          legend: {
            display: false
          },
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
            grid: {
              color: '#333',
              display: true
            },
            ticks: {
              color: '#ccc',
              maxTicksLimit: 8
            }
          },
          y: {
            grid: {
              color: '#333',
              display: true
            },
            ticks: {
              color: '#ccc',
              callback: function (value) {
                return '$' + value;
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
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  updateChart(historyData: any[]) {
    if (!historyData || historyData.length === 0) return;

    const labels = historyData.map(d => d.date);
    const prices = historyData.map(d => d.close);

    // If chart exists, just update data
    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = prices;
      this.chart.update();
    } else {
      // If chart doesn't exist (e.g. first load), initialize it with data
      this.initializeChart(labels, prices);
    }
  }

  toggleDescription() {
    this.isDescriptionExpanded = !this.isDescriptionExpanded;
  }

  ngOnInit() {
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
    // Small delay to allow click event to register on dropdown items
    setTimeout(() => {
      this.searchResults = [];
    }, 200);
  }
}
