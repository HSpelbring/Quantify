import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, catchError, of, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FundService {
  private fundsCache$?: Observable<any>;
  private cacheTime = 60 * 1000; // 1 minute
  private lastFetch = 0;

  constructor(private http: HttpClient) { }

  getFunds(): Observable<any> {
    const now = Date.now();
    const expired = now - this.lastFetch > this.cacheTime;

    // ✅ Reuse cached observable if still valid
    if (this.fundsCache$ && !expired) {
      return this.fundsCache$;
    }

    console.log('⏳ Fetching new funds from backend...');
    this.lastFetch = now;
    this.fundsCache$ = this.http.get('/api/funds').pipe(
      tap(() => console.log('✅ Data received from /api/funds')),
      shareReplay(1),
      catchError(err => {
        console.error('Fund fetch error:', err);
        return of([]);
      })
    );

    return this.fundsCache$;
  }

  getStockDetails(symbol: string): Observable<any> {
    return this.http.get(`/api/stock/${symbol}`).pipe(
      catchError(err => {
        console.error('Stock details fetch error:', err);
        return of({ error: 'Failed to fetch stock details' });
      })
    );
  }

  getFundSimple(symbol: string): Observable<any> {
    return this.http.get(`/api/fund/${symbol}`).pipe(
      catchError(err => {
        console.error('Fund simple fetch error:', err);
        return of({ error: 'Failed to fetch fund' });
      })
    );
  }

  getStockHistory(symbol: string, range: string = '1M'): Observable<any> {
    return this.http.get(`/api/history/${symbol}?range=${range}`).pipe(
      catchError(err => {
        console.error('Stock history fetch error:', err);
        return of({ error: 'Failed to fetch stock history' });
      })
    );
  }

  getMarketInsights(): Observable<any> {
    return this.http.get('/api/insights').pipe(
      catchError(err => {
        console.error('Insights fetch error:', err);
        return of({ error: 'Failed to fetch insights' });
      })
    );
  }

  getNews(symbols: string[] = []): Observable<any[]> {
    // Backend now ignores symbols and serves from DB cache
    return this.http.get<any[]>('/api/news').pipe(
      catchError(err => {
        console.error('News fetch error:', err);
        return of([]);
      })
    );
  }

  refreshNews(): Observable<any> {
    return this.http.post('/api/news/refresh', {}).pipe(
      catchError(err => {
        console.error('News refresh error:', err);
        return of({ error: 'Failed to refresh' });
      })
    );
  }

  searchStocks(query: string): Observable<any[]> {
    if (!query) return of([]);
    return this.http.get<any[]>(`/api/search?q=${query}`).pipe(
      catchError(err => {
        console.error('Search error:', err);
        return of([]);
      })
    );
  }

  // Insider Trading Methods
  ingestInsiderTrades(ticker: string): Observable<any> {
    return this.http.post(`/api/insider/ingest/${ticker}`, {}).pipe(
      catchError(err => {
        console.error('Insider ingestion error:', err);
        return of({ error: 'Failed to ingest insider trades', ingested: 0 });
      })
    );
  }

  getInsiderTrades(ticker: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/insider/trades/${ticker}`).pipe(
      catchError(err => {
        console.error('Insider trades fetch error:', err);
        return of([]);
      })
    );
  }

  getInsiderTradeDetails(id: number): Observable<any> {
    return this.http.get(`/api/insider/trade/${id}`).pipe(
      catchError(err => {
        console.error('Insider trade details error:', err);
        return of({ error: 'Failed to fetch trade details' });
      })
    );
  }

  // SEC EDGAR Insider Trading (Direct from SEC)
  getInsiderTradingSEC(ticker: string): Observable<any[]> {
    return this.http.get<any[]>(`/api/insider-trading?ticker=${ticker}`).pipe(
      catchError(err => {
        console.error('SEC EDGAR fetch error:', err);
        return of([]);
      })
    );
  }
}