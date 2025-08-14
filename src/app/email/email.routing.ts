import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {EmailListComponent} from './email-list/email-list.component';
import {EmailDetailComponent} from './email-detail/email-detail.component';
import {EmailComposeComponent} from './email-compose/email-compose.component';
import {EmailStatsComponent} from './email-stats/email-stats.component';
import {EmailConversationsComponent} from './conversations/email-conversations/email-conversations.component';

const routes: Routes = [
  {path: '', component: EmailListComponent},
  {path: 'read/:id', component: EmailDetailComponent},
  {path: 'compose', component: EmailComposeComponent},
  {path: 'stats', component: EmailStatsComponent},
  {path: 'conversations', component: EmailConversationsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmailRoutingModule {
}
