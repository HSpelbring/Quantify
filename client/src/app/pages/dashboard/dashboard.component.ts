import { Component, AfterViewInit, OnInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { NgFor, CurrencyPipe } from '@angular/common';
import { FundService } from '../../services/fund.service';

interface Fund {
  symbol: string;
  name: string;
  price: number;
  change: number;
  open: number;
  history: number[];   // ✅ REAL intraday sparkline data
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgFor, CurrencyPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  funds: Fund[] = [];
  charts: Chart[] = [];
  portfolio: any = { price: 0, change: 0 };

  constructor(private fundService: FundService) { }

  ngOnInit(): void {
    this.fundService.getFunds().subscribe((data: any) => {
      this.funds = data;

      this.portfolio.price = this.funds.reduce((a: number, f: Fund) => a + f.price, 0);
      this.portfolio.change = this.funds.reduce((a: number, f: Fund) => a + f.change, 0);

      setTimeout(() => this.initializeCharts(), 50);
    });
  }

  ngAfterViewInit(): void {
    // Charts will be created after funds load
  }

  private initializeCharts(): void {
    this.destroyCharts();

    // We duplicate ticker stream 3 times in HTML
    for (let repeat = 0; repeat < 3; repeat++) {
      this.funds.forEach((fund, i) => {
        const id = `fundChart${repeat}_${i}`;
        const canvas = document.getElementById(id) as HTMLCanvasElement;

        if (!canvas) {
          console.warn("Canvas not found:", id);
          return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Choose sparkline color based on positive/negative change
        const color = fund.change >= 0 ? '#4CAF50' : '#F44336';

        const chart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: (fund.history || []).map((_, idx) => idx),
            datasets: [{
              data: fund.history || [],
              borderColor: color,
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
              tension: 0.3,
            },
            {
              data: Array((fund.history || []).length).fill(fund.open),
              borderColor: '#888888',
              borderWidth: 1,
              pointRadius: 0,
              fill: false,
              borderDash: [2, 2],
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { display: false },
              y: { display: false }
            }
          }
        });

        this.charts.push(chart);
      });
    }
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }
}