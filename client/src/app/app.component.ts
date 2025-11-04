import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, HttpClientModule],
  template: `
    <div style="text-align:center; margin-top:50px;">
      <h1>📈 Stock Price Lookup</h1>

      <input
        [(ngModel)]="symbol"
        placeholder="Enter ticker (e.g. AAPL)"
        style="padding:8px; width:200px; margin-right:10px;"
      />
      <button (click)="getPrice()" style="padding:8px 16px;">Fetch Price</button>

      <div *ngIf="price !== null" style="margin-top:25px; font-size:20px;">
        <b>{{ symbol.toUpperCase() }}</b>: $ {{ price }}
      </div>

      <div *ngIf="error" style="color:red; margin-top:10px;">
        {{ error }}
      </div>
    </div>
  `
})
export class AppComponent {
  symbol = '';
  price: number | null = null;
  error = '';

  constructor(private http: HttpClient) {}

  getPrice() {
    this.price = null;
    this.error = '';
    if (!this.symbol.trim()) return;

    this.http.get<any>(`http://localhost:8080/api/price/${this.symbol}`).subscribe({
      next: (data) => {
        if (data.price) this.price = data.price;
        else this.error = data.error || 'No data found.';
      },
      error: (err) => (this.error = err.message || 'Request failed.')
    });
  }
}
