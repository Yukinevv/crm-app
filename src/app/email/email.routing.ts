import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {EmailListComponent} from './email-list/email-list.component';
import {EmailDetailComponent} from './email-detail/email-detail.component';
import {EmailComposeComponent} from './email-compose/email-compose.component';
import {EmailStatsComponent} from './email-stats/email-stats.component';
import {EmailConversationsComponent} from './conversations/email-conversations/email-conversations.component';
import {EmailThreadComponent} from './thread/email-thread/email-thread.component';
import {InboxDetailComponent} from './inbox-detail/inbox-detail.component';
import {EmailBulkComponent} from './email-bulk/email-bulk.component';
import {ImapSettingsComponent} from './imap-settings/imap-settings.component';

const routes: Routes = [
  {path: '', component: EmailListComponent},
  {path: 'read/:id', component: EmailDetailComponent},
  {path: 'inbox/:id', component: InboxDetailComponent},
  {path: 'compose', component: EmailComposeComponent},
  {path: 'bulk', component: EmailBulkComponent},
  {path: 'stats', component: EmailStatsComponent},
  {path: 'conversations', component: EmailConversationsComponent},
  {path: 'thread', component: EmailThreadComponent},
  {path: 'settings/imap', component: ImapSettingsComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmailRoutingModule {
}
