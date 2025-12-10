import { Component, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { NgFor, NgIf } from '@angular/common';
import { icons } from 'lucide';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, NgFor, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements AfterViewInit {
  expanded = false;
  pages = [
    { name: 'Dashboard', route: '/dashboard', icon: 'warehouse.png' },
    { name: 'Portfolio', route: '/portfolio', icon: 'briefcase.png' },
    { name: 'Lookup', route: '/lookup', icon: 'search.png' },
    { name: 'Insights', route: '/insights', icon: 'brain.png' },
    { name: 'News', route: '/news', icon: 'newspaper.png' },
    { name: 'Settings', route: '/settings', icon: 'settings.png' }
  ];

  constructor(private el: ElementRef) { }

  ngAfterViewInit() {
    const iconDivs = this.el.nativeElement.querySelectorAll('[data-icon]');
    iconDivs.forEach((div: HTMLElement) => {
      const iconName = div.dataset['icon'] as keyof typeof icons;
      const iconEntry = icons[iconName];

      // Some Lucide icons may not exist or be improperly typed, so we check and cast
      if (iconEntry && typeof (iconEntry as any).toSvg === 'function') {
        div.innerHTML = (iconEntry as any).toSvg({
          width: 22,
          height: 22,
          stroke: '#dcdcdc',
          'stroke-width': 1.8,
        });
      } else {
        console.warn(`⚠️ Lucide icon "${iconName}" not found.`);
      }
    });
  }

  // Removed manual width manipulation to rely on pure CSS hover states
}
