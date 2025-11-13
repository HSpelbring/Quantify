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

  constructor(private http: HttpClient) {}

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
}