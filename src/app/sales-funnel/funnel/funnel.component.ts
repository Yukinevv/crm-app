import {Component, OnInit} from '@angular/core';
import {Stage} from '../stage.model';
import {Lead} from '../lead.model';
import {SalesFunnelService} from '../sales-funnel.service';
import {CdkDragDrop, DragDropModule, transferArrayItem} from '@angular/cdk/drag-drop';
import {DatePipe, NgForOf} from '@angular/common';
import {RouterLink} from '@angular/router';

@Component({
  selector: 'app-funnel',
  standalone: true,
  imports: [NgForOf, DragDropModule, DatePipe, RouterLink],
  templateUrl: './funnel.component.html',
  styleUrls: ['./funnel.component.scss']
})
export class FunnelComponent implements OnInit {
  stages: Stage[] = [];
  leadsByStage: { [stageId: string]: Lead[] } = {};

  constructor(private service: SalesFunnelService) {
  }

  ngOnInit() {
    this.loadData();
  }

  private loadData() {
    this.service.getStages().subscribe(stages => {
      this.stages = stages.sort((a, b) => a.order - b.order);
      this.stages.forEach(s => (this.leadsByStage[s.id] = []));
      this.service.getLeads().subscribe(leads => {
        leads.forEach(lead => {
          if (!this.leadsByStage[lead.stageId]) {
            this.leadsByStage[lead.stageId] = [];
          }
          this.leadsByStage[lead.stageId].push(lead);
        });
      });
    });
  }

  drop(event: CdkDragDrop<Lead[]>, targetStage: Stage) {
    if (event.previousContainer === event.container) {
      return;
    }
    const lead = event.previousContainer.data[event.previousIndex];
    const updated: Lead = {
      ...lead,
      stageId: targetStage.id,
      stageChangedAt: new Date().toISOString()
    };
    this.service.updateLead(updated).subscribe(() => {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    });
  }
}
