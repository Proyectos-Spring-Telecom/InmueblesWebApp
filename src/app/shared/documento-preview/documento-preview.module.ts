import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentoPreviewComponent } from './documento-preview.component';

@NgModule({
  declarations: [DocumentoPreviewComponent],
  imports: [CommonModule],
  exports: [DocumentoPreviewComponent],
})
export class DocumentoPreviewModule {}
