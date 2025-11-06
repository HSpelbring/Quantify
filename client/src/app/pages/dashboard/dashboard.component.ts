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

  apis = [
    { name: 'YFinance', active: true },
    { name: 'Alpha Vantage', active: true },
    { name: 'Finnhub', active: false },
    { name: 'Polygon.io', active: true },
    { name: 'Go Backend', active: true },
    { name: 'Python FastAPI', active: true },
    { name: 'Redis Cache', active: false },
  ];

  portfolio = { price: 15000432.76, change: 1.72 };

  funds = [
    { name: 'NASDAQ', price: 17385.42, change: 0.82 },
    { name: 'DOW JONES', price: 38645.21, change: -0.24 },
    { name: 'S&P 500', price: 5122.08, change: 0.15 },
    { name: 'RUSSELL 2000', price: 1923.75, change: 1.04 },
  ];

  ngAfterViewInit() {
  const canvas = document.getElementById('portfolioChart') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Canvas context not found!');
    return;
  }

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
}
