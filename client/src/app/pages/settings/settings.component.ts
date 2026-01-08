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

  // Notification Rules
  rules: any[] = [];
  showCreateRule = false;
  newRule: any = {
    name: '',
    definition: {
      universe: { type: 'single_ticker', value: '' },
      timeframe: '1D',
      cooldown_days: 3,
      logic: {
        condition: { var: 'daily_return_pct', op: '>=', value: 0 }
      }
    }
  };

  // Expanded Sections State
  expandedSections: Set<string> = new Set(['Indices', 'Commodities', 'FX', 'Rates', 'Volatility', 'Crypto']);

  toggleSection(section: string) {
    if (this.expandedSections.has(section)) {
      this.expandedSections.delete(section);
    } else {
      this.expandedSections.add(section);
    }
  }

  isSectionExpanded(section: string): boolean {
    return this.expandedSections.has(section);
  }

  constructor(private tickerService: TickerSettingsService) { }

  ngOnInit() {
    this.loadSettings();
    this.checkSystemStatus();
    this.calculateCacheSize();
    this.loadTickerSettings();
    this.loadRules();
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

  loadRules() {
    fetch('http://localhost:8080/api/rules')
      .then(res => res.json())
      .then(data => this.rules = data)
      .catch(err => console.error('Error loading rules:', err));
  }

  createRule() {
    // Basic validation
    if (!this.newRule.name || !this.newRule.definition.universe.value) {
      alert('Please fill in name and ticker/watchlist.');
      return;
    }

    // Convert value to number if operator is numeric
    const cond = this.newRule.definition.logic.condition;
    if (cond.op === '>=' || cond.op === '<=') {
      cond.value = Number(cond.value);
    } else {
      cond.value = null; // for events
    }

    fetch('http://localhost:8080/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.newRule)
    })
      .then(res => res.json())
      .then(data => {
        this.rules.unshift(data);
        this.showCreateRule = false;
        this.resetNewRule();
      })
      .catch(err => console.error('Error creating rule:', err));
  }

  resetNewRule() {
    this.newRule = {
      name: '',
      definition: {
        universe: { type: 'single_ticker', value: '' },
        timeframe: '1D',
        cooldown_days: 3,
        logic: {
          condition: { var: 'daily_return_pct', op: '>=', value: 0 }
        }
      }
    };
  }

  toggleRule(rule: any) {
    rule.enabled = !rule.enabled;
    fetch(`http://localhost:8080/api/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: rule.enabled })
    })
      .then(res => {
        if (!res.ok) rule.enabled = !rule.enabled; // Revert if failed
      })
      .catch(err => {
        console.error('Error toggling rule:', err);
        rule.enabled = !rule.enabled; // Revert
      });
  }

  formatRuleLogic(node: any): string {
    if (!node) return '';
    if (node.condition) {
      const c = node.condition;
      let op = c.op;
      if (op === '>=') op = '≥';
      if (op === '<=') op = '≤';
      if (op === '>') op = '>';
      if (op === '<') op = '<';
      if (op === '==' || op === '=') op = '=';
      if (op === '!=') op = '≠';
      if (op === 'crosses_above') op = 'crosses above';
      if (op === 'crosses_below') op = 'crosses below';

      const varName = c.var.replace(/_/g, ' ').replace('rsi 14', 'RSI (14)').replace('dist ma200 pct', 'Dist from MA200 %').replace('5d pct', '5D %');
      const suffix = c.var.includes('pct') || c.var.includes('avg') || c.var.includes('rsi') ? (c.var.includes('pct') ? '%' : c.var.includes('rsi') ? '' : 'x') : '';
      const val = c.value !== null ? ` ${c.value}${suffix}` : '';
      return `${varName} ${op}${val}`;
    }
    if (node.and) return `(${node.and.map((n: any) => this.formatRuleLogic(n)).join(' AND ')})`;
    if (node.or) return `(${node.or.map((n: any) => this.formatRuleLogic(n)).join(' OR ')})`;
    if (node.not) return `NOT (${this.formatRuleLogic(node.not)})`;
    return '';
  }

  getUniverseLabel(u: any): string {
    if (u.type === 'single_ticker') return u.value;
    if (u.type === 'watchlist') return `Watchlist (${u.value})`;
    return u.value;
  }
}