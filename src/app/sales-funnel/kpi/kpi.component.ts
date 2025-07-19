import {Component, OnInit} from '@angular/core';
import {combineLatest, Observable} from 'rxjs';
import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {Lead} from '../lead.model';
import {AsyncPipe, DecimalPipe, NgForOf, NgIf} from '@angular/common';
import {RouterLink} from '@angular/router';
import {User} from 'firebase/auth';
import {AuthService} from '../../auth/auth.service';

@Component({
  selector: 'app-kpi',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    NgForOf,
    NgIf,
    AsyncPipe
  ],
  templateUrl: './kpi.component.html',
  styleUrls: ['./kpi.component.scss']
})
export class KpiComponent implements OnInit {
  stages: Stage[] = [];
  leads: Lead[] = [];
  leadsByStage: { [stageId: string]: Lead[] } = {};

  stageCounts: { name: string; count: number }[] = [];
  conversionRate = 0;             // w %
  averageStageDurations: { name: string; avgDays: number }[] = [];
  user$: Observable<User | null>;

  constructor(
      private service: SalesFunnelService,
      private auth: AuthService
  ) {
    this.user$ = this.auth.user$;
  }

  ngOnInit() {
    combineLatest({
      stages: this.service.getStages(),
      leads: this.service.getLeads()
    }).subscribe(({stages, leads}) => {
      this.stages = stages.sort((a, b) => a.order - b.order);
      this.leads = leads;

      // Grupowanie
      this.stages.forEach(s => (this.leadsByStage[s.id] = []));
      this.leads.forEach(l => (this.leadsByStage[l.stageId] ||= []).push(l));

      this.computeStageCounts();
      this.computeConversionRate();
      this.computeAverageDurations();
    });
  }

  private computeStageCounts() {
    this.stageCounts = this.stages.map(s => ({
      name: s.name,
      count: this.leadsByStage[s.id]?.length || 0
    }));
  }

  private computeConversionRate() {
    if (!this.stages.length || !this.leads.length) {
      this.conversionRate = 0;
      return;
    }
    const lastStageId = this.stages[this.stages.length - 1].id;
    const converted = this.leadsByStage[lastStageId]?.length || 0;
    this.conversionRate = Math.round((converted / this.leads.length) * 10000) / 100;
  }

  private computeAverageDurations() {
    const now = Date.now();
    this.averageStageDurations = this.stages.map(s => {
      const arr = this.leadsByStage[s.id] || [];
      if (!arr.length) {
        return {name: s.name, avgDays: 0};
      }
      const totalMs = arr.reduce((sum, lead) => {
        const entered = new Date(lead.stageChangedAt).getTime();
        return sum + (now - entered);
      }, 0);
      const avgDays = totalMs / (1000 * 60 * 60 * 24) / arr.length;
      return {name: s.name, avgDays: Math.round(avgDays * 100) / 100};
    });
  }
}
