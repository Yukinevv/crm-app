import {Component} from '@angular/core';

@Component({
  selector: 'app-test',
  standalone: true,
  template: `
    <div class="container mt-4">
      <h2>Testowy moduł</h2>
      <p>To jest przykładowy widok dla nowego modułu.</p>
    </div>
  `
})
export class TestComponent {
}
