import { Component } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lookup',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  templateUrl: './lookup.component.html',
  styleUrls: ['./lookup.component.css']
})
export class LookupComponent {

  query = '';
  previous: string[] = [];
  timeframes = ['1D', '5D', '1M', '3M', '6M', '1Y', '5Y', 'MAX'];
  activeTF = '1D';

  details: any = {
    symbol: '',
    price: '',
    change: '',
    dayRange: '',
    yearRange: '',
    marketCap: '',
    volume: '',
    avgVolume: '',
    pe: '',
    eps: ''
  };

  watchlist = [
    { symbol: 'AAPL', price: 212.54 },
    { symbol: 'NVDA', price: 131.20 },
    { symbol: 'MSFT', price: 415.33 },
    { symbol: 'AMD', price: 158.22 }
  ];

  history = [
    { symbol: 'AAPL', when: '2h ago' },
    { symbol: 'TSLA', when: 'Yesterday' },
    { symbol: 'SPY', when: '3d ago' }
  ];

  onSearch() {
    if (!this.query.trim()) return;

    if (!this.previous.includes(this.query.toUpperCase())) {
      this.previous.unshift(this.query.toUpperCase());
    }

    // TODO: Fetch details + update chart
    console.log('Searching:', this.query);
  }

  selectPrevious(symbol: string) {
    this.query = symbol;
    this.onSearch();
  }

  changeTimeframe(tf: string) {
    this.activeTF = tf;
    console.log('Changing timeframe to:', tf);
    // TODO: Reload chart data based on timeframe
  }
}
