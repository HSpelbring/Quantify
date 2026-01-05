import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for NgIf, NgFor etc.
import { FormsModule } from '@angular/forms';
import { TickerSettingsService } from '../../services/ticker-settings.service';
import { TICKER_INSTRUMENTS, TickerInstrument } from '../../config/ticker.config';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule], // Add FormsModule here
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  // System Status
  backendOnline = false;
  latency = 0;
  cacheSize = '0 KB';

  // Configuration
  keys = {
    finnhub: '',
    alpha: ''
  };

  preferences = {
    timeframe: '1M',
    autoRefresh: true,
    animations: true
  };

  // Ticker Configuration
  availableInstruments = TICKER_INSTRUMENTS;
  selectedTickerSymbols: Set<string> = new Set();
  tickerSaveError = '';

  // Computed Categories for UI
  categories = ['Indices', 'Commodities', 'FX', 'Rates', 'Volatility', 'Crypto'];

  constructor(private tickerService: TickerSettingsService) { }

  ngOnInit() {
    this.loadSettings();
    this.checkSystemStatus();
    this.calculateCacheSize();
    this.loadTickerSettings();
  }

  loadSettings() {
    const savedKeys = localStorage.getItem('quantify_api_keys');
    if (savedKeys) {
      this.keys = JSON.parse(savedKeys);
    }

    const savedPrefs = localStorage.getItem('quantify_prefs');
    if (savedPrefs) {
      this.preferences = JSON.parse(savedPrefs);
    }
  }

  loadTickerSettings() {
    const saved = this.tickerService.getSelectedSymbols();
    this.selectedTickerSymbols = new Set(saved);
  }

  getInstrumentsByCategory(cat: string): TickerInstrument[] {
    return this.availableInstruments.filter(i => i.category === cat);
  }

  isTickerSelected(symbol: string): boolean {
    return this.selectedTickerSymbols.has(symbol);
  }

  toggleTicker(symbol: string) {
    if (this.selectedTickerSymbols.has(symbol)) {
      this.selectedTickerSymbols.delete(symbol);
    } else {
      this.selectedTickerSymbols.add(symbol);
    }
    this.validateTickerSettings();
  }

  validateTickerSettings(): boolean {
    if (this.selectedTickerSymbols.size < this.tickerService.getMinSelectionCount()) {
      this.tickerSaveError = `Minimum ${this.tickerService.getMinSelectionCount()} instruments required.`;
      return false;
    }
    this.tickerSaveError = '';
    return true;
  }

  saveTickerSettings() {
    if (!this.validateTickerSettings()) return;

    try {
      this.tickerService.saveSelectedSymbols(Array.from(this.selectedTickerSymbols));
      alert('Ticker settings saved! Refresh dashboard to see changes.');
    } catch (e) {
      alert(e);
    }
  }

  saveKeys() {
    localStorage.setItem('quantify_api_keys', JSON.stringify(this.keys));
    alert('API Keys saved successfully!');
  }

  testKeys() {
    alert('Test connection functionality coming soon (requires backend proxy).');
  }

  calculateCacheSize() {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += ((localStorage[key].length + key.length) * 2);
      }
    }
    this.cacheSize = (total / 1024).toFixed(2) + ' KB';
  }

  checkSystemStatus() {
    this.calculateCacheSize();
    const start = Date.now();
    // Simulate a ping to localhost:8080/api/health
    fetch('http://localhost:8080/api/health')
      .then(res => {
        this.backendOnline = res.ok;
        this.latency = Date.now() - start;
      })
      .catch(() => {
        this.backendOnline = false;
        this.latency = 0;
      });
  }

  clearCache() {
    if (confirm('Are you sure you want to clear all cached data?')) {
      localStorage.removeItem('quantify_portfolio');
      localStorage.removeItem('quantify_api_keys');
      localStorage.removeItem('quantify_prefs');
      localStorage.removeItem('quantify_ticker_settings');
      location.reload();
    }
  }

  resetPortfolio() {
    if (confirm('This will DELETE all your portfolio data. Continue?')) {
      localStorage.removeItem('quantify_portfolio');
      location.reload();
    }
  }
}