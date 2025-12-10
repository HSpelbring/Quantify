import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { FundService } from '../../services/fund.service';
import { forkJoin, map, of } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe, FormsModule],
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

  holdings = [
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

  // Modal properties
  showBuyModal = false;
  showSellModal = false;

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

  get ownedSymbols(): string[] {
    return this.holdings.map(h => h.symbol);
  }

  ngOnInit() {
    // Initial data load
    this.calculateTotalValue();
  }

  ngAfterViewInit() {
    this.loadPortfolioHistory();
  }

  buyStock() {
    this.buyData = { symbol: '', shares: 0, price: 0 };
    this.showBuyModal = true;
  }

  sellStock() {
    this.sellData = { symbol: '', shares: 0 };
    this.showSellModal = true;
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
        change: 0
      });
    }

    this.calculateTotalValue();
    this.closeModals();
    this.loadPortfolioHistory(); // Refresh graph
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

    this.calculateTotalValue();
    this.closeModals();
    this.loadPortfolioHistory(); // Refresh graph
  }

  closeModals() {
    this.showBuyModal = false;
    this.showSellModal = false;
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

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value',
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
        maintainAspectRatio: false, // Important for fitting in container
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
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
            grid: { color: '#333', display: false },
            ticks: { color: '#ccc', maxTicksLimit: 8 }
          },
          y: {
            grid: { color: '#333', display: true },
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
}
