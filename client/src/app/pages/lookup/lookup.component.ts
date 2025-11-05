import { Component } from '@angular/core';

@Component({
  selector: 'app-lookup',
  standalone: true,
  template: `
    <div class="page">
      <h1>🔍 Stock Lookup</h1>
      <p>Search for any stock and view detailed analytics here.</p>
    </div>
  `,
  styles: [`
    .page {
      padding: 20px;
      color: #fff;
    }
  `]
})
export class LookupComponent {}
