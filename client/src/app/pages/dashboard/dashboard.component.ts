import { Component, AfterViewInit, OnInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { NgFor, CurrencyPipe } from '@angular/common';
import { FundService } from '../../services/fund.service';

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
export class DashboardComponent implements OnInit, AfterViewInit {
  funds: Fund[] = [];
  portfolio = {
    price: 15000,
    change: 2.5
  };

  private charts: Chart[] = [];
  private chartsInitialized = false;

  constructor(private fundService: FundService) {}

  ngOnInit(): void {
    this.loadFundsOnce();
  }

  ngAfterViewInit(): void {
    // Nothing here — prevent duplicate fetch
  }

  private loadFundsOnce(): void {
    this.fundService.getFunds().subscribe({
      next: (data: any) => {
        this.funds = data.map((f: any) => ({
          ...f,
          data: [0, 2, 3, 2, 4]
        }));

        if (!this.chartsInitialized) {
          setTimeout(() => this.initializeCharts(), 300);
          this.chartsInitialized = true;
        } else {
          this.refreshCharts();
        }
      },
      error: (err: any) => console.error('Fund load error', err)
    });
  }

  private initializeCharts(): void {
    this.destroyCharts();

    this.funds.forEach((fund: Fund, i: number) => {
      const canvas = document.getElementById(`fundChart0_${i}`) as HTMLCanvasElement | null;
      if (canvas) this.createChart(canvas, fund);
    });
  }

  private createChart(canvas: HTMLCanvasElement, fund: Fund): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: fund.data.map((_, i) => i.toString()),
        datasets: [{
          data: fund.data,
          borderColor: fund.change > 0 ? '#4CAF50' : '#F44336',
          borderWidth: 2,
          fill: false,
          tension: 0.4
        }]
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

  private refreshCharts(): void {
    this.destroyCharts();
    this.initializeCharts();
  }

  private destroyCharts(): void {
    this.charts.forEach((chart: Chart) => chart.destroy());
    this.charts = [];
  }
}