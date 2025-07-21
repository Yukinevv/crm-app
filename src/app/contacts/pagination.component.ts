import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav aria-label="Paginacja">
      <ul class="pagination justify-content-center">
        <li class="page-item" [class.disabled]="currentPage === 1">
          <button class="page-link" (click)="setPage(1)" [disabled]="currentPage === 1">First</button>
        </li>
        <li class="page-item" [class.disabled]="currentPage === 1">
          <button class="page-link" (click)="setPage(currentPage - 1)" [disabled]="currentPage === 1">Previous</button>
        </li>
        <li class="page-item" *ngFor="let page of pages" [class.active]="page === currentPage">
          <button class="page-link" (click)="setPage(page)">{{ page }}</button>
        </li>
        <li class="page-item" [class.disabled]="currentPage === totalPages">
          <button class="page-link" (click)="setPage(currentPage + 1)" [disabled]="currentPage === totalPages">Next
          </button>
        </li>
        <li class="page-item" [class.disabled]="currentPage === totalPages">
          <button class="page-link" (click)="setPage(totalPages)" [disabled]="currentPage === totalPages">Last</button>
        </li>
      </ul>
    </nav>
  `,
  styles: [`
    .pagination {
      margin: 1rem 0;
    }

    .page-item {
      margin: 0 0.25rem;
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
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.currentPageChange.emit(this.currentPage);
  }
}
