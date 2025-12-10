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

  searchStocks(query: string): Observable<any[]> {
    if (!query) return of([]);
    return this.http.get<any[]>(`/api/search?q=${query}`).pipe(
      catchError(err => {
        console.error('Search error:', err);
        return of([]);
      })
    );
  }
}