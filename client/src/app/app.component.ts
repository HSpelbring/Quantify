import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="layout">
      <app-navbar></app-navbar>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }

    .layout {
      display: flex;
      flex-direction: row;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background-color: #181818;
      color: white;
    }

    .content {
      flex: 1;
      overflow: hidden; /* ✅ prevent scrolling here */
      padding: 40px;
      position: relative;
      z-index: 1;
    }

    .content-inner {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      overflow-y: auto; /* optional inner scroll if you ever have long content */
      padding: 40px;
    }
  `]
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
