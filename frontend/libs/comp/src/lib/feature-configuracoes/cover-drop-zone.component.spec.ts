/**
 * cover-drop-zone.component.spec.ts
 * FE-COMP-013: CoverDropZoneComponent — file validation and visibility.
 */
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CoverDropZoneComponent } from './cover-drop-zone.component';
import { CompUiError } from '../comp-error.mapper';

@Component({
  standalone: true,
  imports: [CoverDropZoneComponent],
  template: `
    <comp-cover-drop-zone
      [capaUrl]="capaUrl()"
      [uploading]="uploading()"
      [error]="error()"
      [canEdit]="canEdit()"
      (fileSelected)="onFile($event)"
      (remove)="onRemove()"
    />
  `,
})
class HostComponent {
  capaUrl   = signal<string | null>(null);
  uploading = signal(false);
  error     = signal<CompUiError | null>(null);
  canEdit   = signal(true);
  lastFile: File | null = null;
  removed = false;
  onFile(f: File): void { this.lastFile = f; }
  onRemove(): void { this.removed = true; }
}

function makeFile(name: string, type: string, size: number): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

describe('CoverDropZoneComponent', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the drop zone when capaUrl is null and not uploading', () => {
    const fixture = setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="button"]')).toBeTruthy();
  });

  it('shows spinner when uploading=true', () => {
    const fixture = setup();
    fixture.componentInstance.uploading.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Enviando');
  });

  it('shows cover preview when capaUrl is set', () => {
    const fixture = setup();
    fixture.componentInstance.capaUrl.set('https://cdn.example.com/capa.jpg');
    fixture.detectChanges();
    const img: HTMLImageElement | null = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.src).toContain('capa.jpg');
  });

  it('emits remove when the Remover button is clicked', () => {
    const fixture = setup();
    fixture.componentInstance.capaUrl.set('https://cdn.example.com/capa.jpg');
    fixture.detectChanges();
    const btn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button');
    btn?.click();
    expect(fixture.componentInstance.removed).toBe(true);
  });

  it('sets clientError too-large when file exceeds 10 MB', () => {
    const fixture = setup();
    const dropZone = fixture.debugElement.query(
      el => el.componentInstance instanceof CoverDropZoneComponent,
    ).componentInstance as CoverDropZoneComponent;

    const bigFile = makeFile('big.jpg', 'image/jpeg', 11 * 1024 * 1024);
    // Access private method via type cast for test coverage
    (dropZone as unknown as { validateAndEmit(f: File): void }).validateAndEmit(bigFile);
    fixture.detectChanges();

    expect(dropZone.clientError()).toBe('too-large');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('10 MB');
  });

  it('sets clientError unsupported-format for TIFF files', () => {
    const fixture = setup();
    const dropZone = fixture.debugElement.query(
      el => el.componentInstance instanceof CoverDropZoneComponent,
    ).componentInstance as CoverDropZoneComponent;

    const tiffFile = makeFile('image.tiff', 'image/tiff', 1024);
    (dropZone as unknown as { validateAndEmit(f: File): void }).validateAndEmit(tiffFile);
    fixture.detectChanges();

    expect(dropZone.clientError()).toBe('unsupported-format');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Formato inválido');
  });

  it('emits fileSelected for a valid JPEG under 10 MB', () => {
    const fixture = setup();
    const dropZone = fixture.debugElement.query(
      el => el.componentInstance instanceof CoverDropZoneComponent,
    ).componentInstance as CoverDropZoneComponent;

    const validFile = makeFile('cover.jpg', 'image/jpeg', 1024 * 1024);
    (dropZone as unknown as { validateAndEmit(f: File): void }).validateAndEmit(validFile);

    expect(fixture.componentInstance.lastFile).toBe(validFile);
    expect(dropZone.clientError()).toBeNull();
  });

  it('hides write affordances when canEdit=false', () => {
    const fixture = setup();
    fixture.componentInstance.canEdit.set(false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // Button area disabled — cursor-not-allowed style applied
    const button = el.querySelector('[aria-disabled="true"]');
    expect(button).toBeTruthy();
  });
});
