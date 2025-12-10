import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, CommonModule } from '@angular/common';
import { FundService } from '../../services/fund.service';

@Component({
    selector: 'app-insights',
    standalone: true,
    imports: [NgFor, NgIf, CommonModule],
    templateUrl: './insights.component.html',
    styleUrls: ['./insights.component.css']
})
export class InsightsComponent implements OnInit {
    fundService = inject(FundService);

    loading = true;
    error = '';

    sentiment: any = {
        score: 0,
        label: '-',
        summary: '-'
    };

    sectors: any[] = [];
    news: any[] = [];

    ngOnInit() {
        this.fetchInsights();
    }

    fetchInsights() {
        this.loading = true;
        this.fundService.getMarketInsights().subscribe({
            next: (data) => {
                if (data.error) {
                    this.error = 'Failed to load insights.';
                } else {
                    this.sentiment = data.sentiment;
                    this.sectors = data.sectors;
                    this.news = data.news;
                }
                this.loading = false;
            },
            error: (err) => {
                console.error(err);
                this.error = 'Unable to connect to service.';
                this.loading = false;
            }
        });
    }

    getSentimentColor(score: number): string {
        if (score < 25) return '#ff4444'; // Red (Extreme Fear)
        if (score < 45) return '#ff8800'; // Orange (Fear)
        if (score > 75) return '#00C851'; // Green (Extreme Greed)
        if (score > 55) return '#99cc00'; // Light Green (Greed)
        return '#ffbb33'; // Yellow (Neutral)
    }
}
