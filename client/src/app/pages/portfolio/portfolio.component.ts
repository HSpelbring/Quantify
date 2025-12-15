import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, NgFor, NgIf, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { FundService } from '../../services/fund.service';
import { forkJoin, map, of } from 'rxjs';

Chart.register(...registerables);

interface Holding {
  symbol: string;
  shares: number;
  avgCost: number;
  price: number;
  change: number;
  sector?: string;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, NgFor, NgIf, DecimalPipe, FormsModule, DatePipe],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent implements OnInit, AfterViewInit {

  fundService = inject(FundService);

  totalValue = 52341.22;
  dailyChange = +412.55;
  pctChange = +0.79;
  uninvestedCash = 25000.00;

  // Used for the main portfolio graph timeframes
  timeframes = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'];
  activeTF = '1M';

  holdings: Holding[] = [
    {
      symbol: 'AAPL',
      shares: 22,
      avgCost: 187.20,
      price: 212.54,
      change: +1.52
    },
    {
      symbol: 'NVDA',
      shares: 10,
      avgCost: 524.00,
      price: 131.22,
      change: -0.41
    },
    {
      symbol: 'MSFT',
      shares: 16,
      avgCost: 340.10,
      price: 415.33,
      change: +0.18
    }
  ];

  transactions: any[] = [];

  // Modal properties
  showBuyModal = false;
  showSellModal = false;
  buyError = '';
  sellError = '';

  sortColumn = 'total';
  sortDirection: 'asc' | 'desc' = 'desc';

  showToast = false;
  toastMessage = '';

  // Form data
  buyData = {
    symbol: '',
    shares: 0,
    price: 0
  };

  sellData = {
    symbol: '',
    shares: 0
  };

  chart: Chart | null = null;
  sectorChart: Chart | null = null;
  refreshInterval: any;

  get ownedSymbols(): string[] {
    return this.holdings.map(h => h.symbol);
  }

  ngOnInit() {
    this.loadPreferences();
    this.loadPortfolio();
    this.ensureSectorsPopulated(); // Fetch real sectors for loaded holdings
    this.loadFunds(); // Update prices for current holdings
    this.calculateTotalValue();
    this.sortHoldings();
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadPreferences() {
    const saved = localStorage.getItem('quantify_prefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      if (prefs.timeframe) {
        this.activeTF = prefs.timeframe;
      }
      if (prefs.autoRefresh) {
        // Auto-refresh every 60 seconds
        this.refreshInterval = setInterval(() => {
          this.loadFunds();
        }, 60000);
      }
    }
  }

  // --- PERSISTENCE ---

  savePortfolio() {
    const data = {
      holdings: this.holdings,
      uninvestedCash: this.uninvestedCash,
      transactions: this.transactions
    };
    localStorage.setItem('quantify_portfolio', JSON.stringify(data));
  }

  loadPortfolio() {
    const saved = localStorage.getItem('quantify_portfolio');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.holdings && typeof data.uninvestedCash === 'number') {
          this.holdings = data.holdings;
          this.uninvestedCash = data.uninvestedCash;
        }
        if (data.transactions) {
          this.transactions = data.transactions;
        }
      } catch (e) {
        console.error('Failed to load portfolio', e);
      }
    }
  }

  loadFunds() {
    if (this.holdings.length === 0) return;

    // Fetch latest price for each holding
    const requests = this.holdings.map(h =>
      this.fundService.getStockDetails(h.symbol).pipe(
        map(details => ({
          symbol: h.symbol,
          price: details.price || h.price,
          change: details.changePercent || 0
        }))
      )
    );

    forkJoin(requests).subscribe(results => {
      results.forEach(res => {
        const holding = this.holdings.find(h => h.symbol === res.symbol);
        if (holding) {
          holding.price = res.price;
          holding.change = res.change;
        }
      });
      this.calculateTotalValue();
      this.updateSectorChart(); // Re-update sector chart with fresh values
    });
  }

  // --- UX HELPERS ---

  showToastNotification(message: string) {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  ngAfterViewInit() {
    this.loadPortfolioHistory();
    this.updateSectorChart();
  }

  buyStock() {
    this.buyData = { symbol: '', shares: 0, price: 0 };
    this.showBuyModal = true;
  }

  sellStock() {
    this.sellData = { symbol: '', shares: 0 };
    this.sellError = '';
    this.showSellModal = true;
  }

  setMaxSell() {
    if (!this.sellData.symbol) return;
    const holding = this.holdings.find(h => h.symbol === this.sellData.symbol);
    if (holding) {
      this.sellData.shares = holding.shares;
    }
  }

  confirmBuy() {
    if (!this.buyData.symbol || this.buyData.shares <= 0 || this.buyData.price <= 0) return;

    const totalCost = this.buyData.shares * this.buyData.price;
    if (totalCost > this.uninvestedCash) {
      alert('Insufficient funds');
      return;
    }

    this.uninvestedCash -= totalCost;

    // Check if we already own this stock
    const existing = this.holdings.find(h => h.symbol === this.buyData.symbol.toUpperCase());
    if (existing) {
      // Update existing holding (average cost calculation simplified)
      const currentTotalValue = existing.shares * existing.avgCost;
      const newTotalValue = currentTotalValue + totalCost;
      const newTotalShares = existing.shares + this.buyData.shares;

      existing.shares = newTotalShares;
      existing.avgCost = newTotalValue / newTotalShares;
    } else {
      // Add new holding
      this.holdings.push({
        symbol: this.buyData.symbol.toUpperCase(),
        shares: this.buyData.shares,
        avgCost: this.buyData.price,
        price: this.buyData.price, // Assuming current price is purchase price for now
        change: 0,
        sector: 'Unknown' // Will be populated shortly
      });
    }

    this.transactions.unshift({
      type: 'BUY',
      symbol: this.buyData.symbol.toUpperCase(),
      shares: this.buyData.shares,
      price: this.buyData.price,
      date: new Date()
    });

    this.showToastNotification(`Successfully bought ${this.buyData.shares} shares of ${this.buyData.symbol.toUpperCase()} `);
    this.calculateTotalValue();
    this.sortHoldings();
    this.savePortfolio();
    this.closeModals();
    this.loadPortfolioHistory(); // Refresh graph
    this.ensureSectorsPopulated(); // Fetch sector for new stock
    this.updateSectorChart();
  }

  confirmSell() {
    if (!this.sellData.symbol || this.sellData.shares <= 0) return;

    const holding = this.holdings.find(h => h.symbol === this.sellData.symbol);
    if (!holding) return;

    if (this.sellData.shares > holding.shares) {
      alert('Cannot sell more shares than you own');
      return;
    }

    const valueSold = this.sellData.shares * holding.price;
    this.uninvestedCash += valueSold;

    holding.shares -= this.sellData.shares;

    // Remove if 0 shares
    if (holding.shares === 0) {
      this.holdings = this.holdings.filter(h => h.symbol !== this.sellData.symbol);
    }

    this.transactions.unshift({
      type: 'SELL',
      symbol: this.sellData.symbol,
      shares: this.sellData.shares,
      price: holding.price,
      date: new Date()
    });

    this.showToastNotification(`Successfully sold ${this.sellData.shares} shares of ${this.sellData.symbol} `);
    this.calculateTotalValue();
    this.sortHoldings();
    this.savePortfolio();
    this.closeModals();
    this.loadPortfolioHistory(); // Refresh graph
    this.updateSectorChart();
  }

  closeModals() {
    this.showBuyModal = false;
    this.showSellModal = false;
  }

  // --- SORTING ---

  toggleSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'desc'; // Default to desc for most financial data
    }
    this.sortHoldings();
  }

  sortHoldings() {
    this.holdings.sort((a, b) => {
      const valA = this.getSortValue(a, this.sortColumn);
      const valB = this.getSortValue(b, this.sortColumn);

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getSortValue(holding: any, column: string): number | string {
    if (column === 'total') {
      return holding.shares * holding.price;
    }
    return holding[column];
  }



  changeTF(tf: string) {
    this.activeTF = tf;
    this.loadPortfolioHistory();
  }

  calculateTotalValue() {
    let holdingsValue = 0;
    this.holdings.forEach(h => {
      holdingsValue += h.shares * h.price;
    });
    this.totalValue = holdingsValue + this.uninvestedCash;
  }

  loadPortfolioHistory() {
    if (this.holdings.length === 0) {
      this.updateChart([], []);
      return;
    }

    // Create an observable for each holding to fetch its history
    const requests = this.holdings.map(h =>
      this.fundService.getStockHistory(h.symbol, this.activeTF).pipe(
        map(res => ({ symbol: h.symbol, shares: h.shares, data: res.data || [] }))
      )
    );

    forkJoin(requests).subscribe(results => {
      // Aggregate data
      // Map: Date -> Total Value
      const dateMap = new Map<string, number>();

      results.forEach(item => {
        item.data.forEach((point: any) => {
          const date = point.date;
          const val = point.close * item.shares;

          if (dateMap.has(date)) {
            dateMap.set(date, dateMap.get(date)! + val);
          } else {
            dateMap.set(date, val);
          }
        });
      });

      // Sort dates
      const sortedDates = Array.from(dateMap.keys()).sort();

      // Create final data array (adding uninvested cash to each point representing "Portfolio Value")
      const data = sortedDates.map(date => dateMap.get(date)! + this.uninvestedCash);

      // Pass aggregated data to chart
      this.updateChart(sortedDates, data);
    });
  }

  updateChart(labels: string[], data: number[]) {
    const canvas = document.getElementById('portfolioChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(76, 175, 80, 0.4)');
    gradient.addColorStop(1, 'rgba(76, 175, 80, 0.0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value',
          data: data,
          borderColor: '#4caf50',
          backgroundColor: gradient,
          borderWidth: 2,
          fill: true,
          tension: 0.3, // Smoother curve
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Important for fitting in container
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(20, 20, 20, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
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
            grid: { color: 'rgba(255, 255, 255, 0.05)', display: true },
            ticks: { color: '#888', maxTicksLimit: 6 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)', display: true },
            ticks: {
              color: '#888',
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

  ensureSectorsPopulated() {
    // Identify symbols with missing sector
    const missing = this.holdings.filter(h => !h.sector || h.sector === 'Unknown');
    if (missing.length === 0) {
      this.updateSectorChart();
      return;
    }

    console.log(`Fetching sectors for ${missing.length} holdings...`);

    const requests = missing.map(h =>
      this.fundService.getStockDetails(h.symbol).pipe(
        map(details => ({ symbol: h.symbol, sector: details.sector || 'Others' }))
      )
    );

    // Run all requests in parallel
    forkJoin(requests).subscribe({
      next: (results) => {
        results.forEach(res => {
          const holding = this.holdings.find(h => h.symbol === res.symbol);
          if (holding) {
            holding.sector = res.sector;
          }
        });
        this.savePortfolio(); // Persist the fetched sectors
        this.updateSectorChart(); // Re-render chart
      },
      error: (err) => console.error('Error fetching sectors:', err)
    });
  }

  updateSectorChart() {
    const canvas = document.getElementById('sectorChart') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.sectorChart) {
      this.sectorChart.destroy();
    }

    // specific grouping logic check
    const sectorMap: { [key: string]: number } = {};

    this.holdings.forEach(h => {
      // Use real sector if available, else temporary 'Loading/Unknown'
      const sector = h.sector || 'Unknown';
      const value = h.shares * h.price;

      if (sectorMap[sector]) {
        sectorMap[sector] += value;
      } else {
        sectorMap[sector] = value;
      }
    });

    const labels = Object.keys(sectorMap);
    const data = Object.values(sectorMap);

    // If "Unknown" is the only sector and we have holdings, it might mean data is still loading
    // We can show a placeholder or just render as is.

    const backgroundColors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#E7E9ED', '#71B37C', '#8A6EAF', '#2E8B57'
    ];

    this.sectorChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#ccc', font: { size: 11 }, boxWidth: 10, padding: 20 }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw as number;
                const total = ctx.dataset.data.reduce((a: any, b: any) => a + b, 0) as number;
                const pct = ((val / total) * 100).toFixed(1) + '%';
                return `${ctx.label}: ${pct}`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }
}
