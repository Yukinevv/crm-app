import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav aria-label="Paginacja" class="app-pagination">
      <ul class="pagination justify-content-center">
        <li class="page-item" [class.disabled]="currentPage === 1">
          <button class="page-link" (click)="setPage(1)" [disabled]="currentPage === 1" aria-label="Pierwsza strona">
            Pierwsza
          </button>
        </li>

        <li class="page-item" [class.disabled]="currentPage === 1">
          <button class="page-link" (click)="setPage(currentPage - 1)" [disabled]="currentPage === 1"
                  aria-label="Poprzednia strona">
            Poprzednia
          </button>
        </li>

        <li class="page-item" *ngFor="let page of pages" [class.active]="page === currentPage">
          <button class="page-link" (click)="setPage(page)" [attr.aria-current]="page === currentPage ? 'page' : null">
            {{ page }}
          </button>
        </li>

        <li class="page-item" [class.disabled]="currentPage === totalPages">
          <button class="page-link" (click)="setPage(currentPage + 1)" [disabled]="currentPage === totalPages"
                  aria-label="Następna strona">
            Następna
          </button>
        </li>

        <li class="page-item" [class.disabled]="currentPage === totalPages">
          <button class="page-link" (click)="setPage(totalPages)" [disabled]="currentPage === totalPages"
                  aria-label="Ostatnia strona">
            Ostatnia
          </button>
        </li>
      </ul>
    </nav>
  `,
  styles: [`
    .app-pagination {
      margin: 1rem 0;
    }

    .pagination {
      gap: .25rem;
      background: transparent;
    }

    .page-item {
      transition: transform var(--transition-fast);
    }

    .page-item:not(.disabled):hover {
      transform: translateY(-1px);
    }

    .page-link {
      border-radius: .6rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text);
      padding: .4rem .75rem;
      box-shadow: var(--shadow-xs);
      transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
    }

    .page-link:hover {
      background: color-mix(in srgb, var(--color-surface) 88%, var(--color-primary-100) 12%);
      border-color: color-mix(in srgb, var(--color-border) 55%, var(--color-primary) 45%);
      text-decoration: none;
      box-shadow: var(--shadow-sm);
    }

    .page-link:focus-visible {
      outline: none;
      box-shadow: var(--ring-primary);
    }

    .page-item.active .page-link {
      color: #fff;
      background: var(--color-primary);
      border-color: var(--color-primary);
      box-shadow: var(--shadow-sm);
      cursor: default;
    }

    .page-item.disabled .page-link,
    .page-link[disabled] {
      color: var(--color-muted);
      background: color-mix(in srgb, var(--color-surface) 96%, var(--color-bg) 4%);
      border-color: var(--color-border);
      box-shadow: none;
      pointer-events: none;
    }
  `]
})
export class PaginationComponent {
  @Input() totalItems = 0;
  @Input() pageSize = 5;
  @Input() currentPage = 1;
  @Output() currentPageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  get pages(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.currentPageChange.emit(this.currentPage);
  }
}
