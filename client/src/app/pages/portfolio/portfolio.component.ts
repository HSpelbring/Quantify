import { Component } from '@angular/core';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [NgFor, NgIf, DecimalPipe],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.css']
})
export class PortfolioComponent {

  totalValue = 52341.22;
  dailyChange = +412.55; 
  pctChange = +0.79;

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

  // Placeholder functions for future buying/selling logic
  buyStock() {
    console.log('Buy stock modal (future)');
  }

  sellStock() {
    console.log('Sell stock modal (future)');
  }

  changeTF(tf: string) {
    this.activeTF = tf;
    console.log('Timeframe changed:', tf);
  }
}
