import {Component} from '@angular/core';
import {Router, RouterLink, RouterOutlet} from '@angular/router';
import {AuthService} from './auth/auth.service';
import {Observable} from 'rxjs';
import {User} from 'firebase/auth';
import {AsyncPipe, NgIf} from '@angular/common';
import {AppFooterComponent} from './app-footer/app-footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgIf, AsyncPipe, AppFooterComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  sidebarOpen = false;
  user$: Observable<User | null>;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    this.user$ = this.auth.user$;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout() {
    this.auth.logout()
      .then(() => this.router.navigate(['/login']))
      .catch(err => console.error('Logout error', err));
  }
}
