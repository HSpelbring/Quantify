import { Component, ElementRef, Input, AfterViewInit, ViewChild, OnChanges, SimpleChanges, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

@Component({
  selector: 'app-sentiment-gauge',
  standalone: true,
  imports: [],
  templateUrl: './sentiment-gauge.html',
  styleUrl: './sentiment-gauge.css',
})
export class SentimentGauge implements AfterViewInit, OnChanges, OnDestroy {
  @Input() score: number = 50; // Default neutral
  @ViewChild('gaugeCanvas') gaugeCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | undefined;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      Chart.register(...registerables);
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.createChart();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isBrowser && changes['score'] && this.chart) {
      // Update chart data if needed, or just re-render needle (if we draw one)
      // For simple gauge, we might just update the text or reference points
      this.updateChart();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser && this.chart) {
      this.chart.destroy();
    }
  }

  getLabel(score: number): string {
    if (score <= 20) return 'Extreme Fear';
    if (score <= 40) return 'Fear';
    if (score <= 60) return 'Neutral';
    if (score <= 80) return 'Greed';
    return 'Extreme Greed';
  }

  private createChart(): void {
    if (!this.gaugeCanvas) return;

    const ctx = this.gaugeCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Gradient or sections
    // 0-20: Red, 20-40: Orange, 40-60: Grey, 60-80: LightGreen, 80-100: Green

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'],
        datasets: [{
          data: [20, 20, 20, 20, 20],
          backgroundColor: [
            '#ef4444', // Red
            '#f97316', // Orange
            '#6b7280', // Grey
            '#84cc16', // Lime
            '#22c55e'  // Green
          ],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        rotation: -90,
        circumference: 180,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    };

    this.chart = new Chart(ctx, config);
    this.drawNeedle(this.chart);
  }

  private updateChart() {
    if (this.chart) {
      this.chart.update();
      this.drawNeedle(this.chart);
    }
  }

  // Custom plugin or method to draw needle could go here, 
  // but for now we'll stick to the gauge coloring and text score.
  // Advanced: Implement custom plugin to draw needle based on 'score'.
  private drawNeedle(chart: Chart) {
    // Placeholder for needle logic if we want to add it directly to canvas 
    // on top of the chart using afterDraw plugin.
  }
}
