import { Component } from '@angular/core';
import { SentimentGauge } from '../../components/sentiment-gauge/sentiment-gauge';
import { SectorHeatmap } from '../../components/sector-heatmap/sector-heatmap';

@Component({
  selector: 'app-market-sentiment',
  standalone: true,
  imports: [SentimentGauge, SectorHeatmap],
  templateUrl: './market-sentiment.html',
  styleUrl: './market-sentiment.css',
})
export class MarketSentiment {

}
