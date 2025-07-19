import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {FunnelComponent} from './funnel/funnel.component';
import {StageConfigComponent} from './stage-config/stage-config.component';
import {LeadDetailComponent} from './lead-detail/lead-detail.component';
import {KpiComponent} from './kpi/kpi.component';

const routes: Routes = [
  {path: '', component: FunnelComponent},
  {path: 'config', component: StageConfigComponent},
  {path: 'lead/new', component: LeadDetailComponent},
  {path: 'lead/:id', component: LeadDetailComponent},
  {path: 'kpi', component: KpiComponent}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalesFunnelRoutingModule {
}
