import { NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { Component, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor, CurrencyPipe, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements AfterViewInit {
  portfolio = { price: 15000432.76, change: 1.72 };

  funds = [
    { name: 'NASDAQ (NDX)', price: 17385.42, change: 0.82 },
    { name: 'DOW JONES (DJI)', price: 38645.21, change: -0.24 },
    { name: 'S&P 500 (INX)', price: 5122.08, change: 0.15 },
    { name: 'RUSSELL 2000 (RUT)', price: 1923.75, change: 1.04 },
    { name: 'Bitcoin (BTC)', price: 100000, change: -0.56 },
    { name: 'VBOE Index (VIX)', price: 22.34, change: 2.13 }
  ];

  ngAfterViewInit() {
    this.createPortfolioChart();
    this.createFundCharts();
  }

  private createPortfolioChart() {
    const canvas = document.getElementById('portfolioChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        datasets: [{
          data: [15000, 15120, 15200, 15350, 15432],
          borderColor: '#4CAF50',
          borderWidth: 2,
          tension: 0.3,
          fill: {
            target: 'origin',
            above: 'rgba(76, 175, 80, 0.15)',
          },
          pointRadius: 0
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }

  private createFundCharts() {
    const total = this.funds.length * 2; // original + duplicate
    for (let i = 0; i < total; i++) {
      const index = i % this.funds.length;
      const fund = this.funds[index];
      const canvas = document.getElementById(`fundChart${i < this.funds.length ? i : 'Duplicate' + index}`) as HTMLCanvasElement;
      if (!canvas) continue;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const data = Array.from({ length: 10 }, () => fund.price * (1 + (Math.random() - 0.5) / 100));

      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map((_, j) => j.toString()),
          datasets: [{
            data,
            borderColor: fund.change > 0 ? '#4CAF50' : '#F44336',
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
            fill: false
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }
}