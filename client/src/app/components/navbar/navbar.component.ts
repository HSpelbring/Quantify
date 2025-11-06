import { Component, HostListener } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NgFor } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, NgFor],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
    expanded = false;

  pages = [
    { emoji: '🏠', name: 'Dashboard', route: '/dashboard' },
    { emoji: '🔍', name: 'Lookup', route: '/lookup' },
    { emoji: '💼', name: 'Portfolio', route: '/portfolio' },
    { emoji: '🧠', name: 'Insights', route: '/insights' },
    { emoji: '📰', name: 'News', route: '/news' },
    { emoji: '⚙️', name: 'Settings', route: '/settings' }
  ];

  @HostListener('mouseenter')
  onMouseEnter() {
    this.expanded = true;
    document.documentElement.style.setProperty('--navbar-width', '200px');
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.expanded = false;
    document.documentElement.style.setProperty('--navbar-width', '70px');
  }
}
