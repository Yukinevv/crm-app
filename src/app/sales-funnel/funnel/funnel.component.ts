import {Component, OnInit} from '@angular/core';
import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {RouterLink} from '@angular/router';
import {NgForOf} from '@angular/common';

@Component({
  selector: 'app-funnel',
  standalone: true,
  imports: [
    RouterLink,
    NgForOf
  ],
  templateUrl: './funnel.component.html',
  styleUrls: ['./funnel.component.scss']
})
export class FunnelComponent implements OnInit {
  stages: Stage[] = [];

  constructor(private service: SalesFunnelService) {
  }

  ngOnInit() {
    this.loadStages();
  }

  loadStages() {
    this.service.getStages().subscribe(stages => {
      this.stages = stages.sort((a, b) => a.order - b.order);
    });
  }
}
