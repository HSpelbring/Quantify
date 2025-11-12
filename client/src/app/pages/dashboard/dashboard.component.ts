import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Fund {
  symbol: string;
  name: string;
  price: number;
  change: number;
  data: number[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgFor, CurrencyPipe, HttpClientModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  portfolio = { price: 0, change: 0 };
  funds: Fund[] = [];

  private charts: Chart[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadFunds();
    setInterval(() => this.loadFunds(), 60000); // auto-refresh every 60s
    console.log("Funds loaded:", this.funds);
  }

  ngAfterViewInit(): void {
    // Wait until DOM is ready
    setTimeout(() => this.initializeCharts(), 300);
  }

  loadFunds(): void {
    this.http.get<any[]>('http://localhost:8080/api/funds').subscribe({
      next: (data) => {
        // Fill in missing dummy graph data for each fund
        this.funds = data.map((f, i) => ({
          ...f,
          data: f.data ?? [0, 1, 2, 1, 3].map((v) => v + Math.random() * 2)
        }));

        // Compute portfolio average (optional)
        if (this.funds.length > 0) {
          const avgPrice = this.funds.reduce((sum, f) => sum + f.price, 0) / this.funds.length;
          const avgChange = this.funds.reduce((sum, f) => sum + f.change, 0) / this.funds.length;
          this.portfolio = {
            price: parseFloat(avgPrice.toFixed(2)),
            change: parseFloat(avgChange.toFixed(2))
          };
        }

        // Refresh charts when new data arrives
        setTimeout(() => this.initializeCharts(), 200);
      },
      error: (err) => {
        console.error('Error loading funds:', err);
      }
    });
  }

  initializeCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];

    const totalRepeats = 3; // matches [0,1,2] loops in HTML
    for (let repeat = 0; repeat < totalRepeats; repeat++) {
      this.funds.forEach((fund, i) => {
        const canvasId = `fundChart${repeat}_${i}`;
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (canvas) this.createChart(canvas, fund);
      });
    }
  }

  createChart(canvas: HTMLCanvasElement, fund: Fund): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: fund.data.map((_, i) => i.toString()),
        datasets: [
          {
            data: fund.data,
            borderColor: fund.change > 0 ? '#4CAF50' : '#F44336',
            borderWidth: 2,
            fill: false,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        elements: { point: { radius: 0 } },
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });

    this.charts.push(chart);
  }
}