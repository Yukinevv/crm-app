import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {SalesFunnelService} from '../sales-funnel.service';
import {Stage} from '../stage.model';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-stage-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './stage-config.component.html',
  styleUrls: ['./stage-config.component.scss']
})
export class StageConfigComponent implements OnInit {
  stages: Stage[] = [];
  form: FormGroup;

  constructor(
    private service: SalesFunnelService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadStages();
  }

  loadStages() {
    this.service.getStages().subscribe(stages => {
      this.stages = stages.sort((a, b) => a.order - b.order);
    });
  }

  addStage() {
    if (this.form.invalid) return;
    const nextOrder =
      this.stages.length > 0
        ? Math.max(...this.stages.map(s => s.order)) + 1
        : 1;
    this.service
      .createStage({name: this.form.value.name, order: nextOrder})
      .subscribe(() => {
        this.form.reset();
        this.loadStages();
      });
  }

  updateStage(stage: Stage) {
    this.service.updateStage(stage).subscribe(() => this.loadStages());
  }

  deleteStage(id: string) {
    this.service.deleteStage(id).subscribe(() => this.loadStages());
  }

  moveUp(stage: Stage) {
    const idx = this.stages.findIndex(s => s.id === stage.id);
    if (idx <= 0) return;
    [this.stages[idx - 1].order, this.stages[idx].order] = [
      this.stages[idx].order,
      this.stages[idx - 1].order
    ];
    this.updateStage(this.stages[idx - 1]);
    this.updateStage(this.stages[idx]);
  }

  moveDown(stage: Stage) {
    const idx = this.stages.findIndex(s => s.id === stage.id);
    if (idx < 0 || idx === this.stages.length - 1) return;
    [this.stages[idx + 1].order, this.stages[idx].order] = [
      this.stages[idx].order,
      this.stages[idx + 1].order
    ];
    this.updateStage(this.stages[idx]);
    this.updateStage(this.stages[idx + 1]);
  }
}
