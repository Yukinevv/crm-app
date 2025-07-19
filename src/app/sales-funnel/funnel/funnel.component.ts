import {Component, OnInit} from '@angular/core';
import {CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import {AsyncPipe, DatePipe, NgForOf, NgIf} from '@angular/common';
import {RouterLink} from '@angular/router';

import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {Lead} from '../lead.model';
import {Observable} from 'rxjs';
import {User} from 'firebase/auth';
import {AuthService} from '../../auth/auth.service';

@Component({
  selector: 'app-funnel',
  standalone: true,
  imports: [NgForOf, DragDropModule, RouterLink, DatePipe, NgIf, AsyncPipe],
  templateUrl: './funnel.component.html',
  styleUrls: ['./funnel.component.scss']
})
export class FunnelComponent implements OnInit {
  stages: Stage[] = [];
  leadsByStage: { [stageId: string]: Lead[] } = {};
  connectedListIds: string[] = [];
  user$: Observable<User | null>;

  constructor(
    private service: SalesFunnelService,
    private auth: AuthService
  ) {
    this.user$ = this.auth.user$;
  }

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.service.getStages().subscribe(stages => {
      this.stages = stages.sort((a, b) => a.order - b.order);
      this.stages.forEach(s => (this.leadsByStage[s.id] = []));

      this.connectedListIds = this.stages.map(s => `stageList-${s.id}`);

      this.service.getLeads().subscribe(leads => {
        leads.forEach(lead => {
          (this.leadsByStage[lead.stageId] ||= []).push(lead);
        });
      });
    });
  }

  drop(event: CdkDragDrop<Lead[]>, targetStage: Stage) {
    // jeśli wewnątrz tej samej listy - tylko reorder
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      return;
    }

    // optymistycznie przenosimy w UI
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // przygotowujemy update
    const lead = event.container.data[event.currentIndex];
    const updatedLead: Lead = {
      ...lead,
      stageId: targetStage.id,
      stageChangedAt: new Date().toISOString()
    };

    // zapis na serwerze
    this.service.updateLead(updatedLead).subscribe({
      next: () => {
        // OK
      },
      error: () => {
        // rollback przy błędzie
        transferArrayItem(
          event.container.data,
          event.previousContainer.data,
          event.currentIndex,
          event.previousIndex
        );
        console.error('Błąd zapisu etapu leada');
      }
    });
  }
}
