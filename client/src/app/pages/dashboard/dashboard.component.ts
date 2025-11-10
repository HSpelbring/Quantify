import { Component, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { NgFor, CurrencyPipe } from '@angular/common';

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
  imports: [NgFor, CurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit {
    portfolio = {
        price: 15000,
        change: 2.5
    };
  
    funds: Fund[] = [
    { symbol: 'RUT', name: 'RUSSELL 2000', price: 1950.2, change: 1.2, data: [0, 2, 3, 2, 4] },
    { symbol: 'BTC', name: 'BITCOIN', price: 37150.5, change: -0.8, data: [4, 3, 2, 1, 2] },
    { symbol: 'VIX', name: 'VBOE Index', price: 17.3, change: -1.1, data: [3, 3, 2, 4, 1] },
    { symbol: 'NDX', name: 'NASDAQ', price: 15800.7, change: 0.9, data: [1, 2, 3, 4, 5] },
    { symbol: 'DJI', name: 'DOW JONES', price: 36000.1, change: 1.4, data: [2, 3, 3, 4, 3] },
    { symbol: 'INX', name: 'S&P 500', price: 4550.3, change: 0.7, data: [2, 2, 3, 2, 4] }
  ];

  private charts: Chart[] = [];

  ngAfterViewInit(): void {
  // Wait until DOM is ready
    setTimeout(() => this.initializeCharts(), 300);
  }

  initializeCharts(): void {
    const totalRepeats = 3; // matches the [0,1,2] repeat sets in HTML

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

    // Destroy old chart if exists
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: fund.data.map((_, i) => i.toString()),
        datasets: [
          {
            data: fund.data,
            borderColor: fund.change > 0 ? '#4CAF50' : '#F44336',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        elements: { point: { radius: 0 } },
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  }
}