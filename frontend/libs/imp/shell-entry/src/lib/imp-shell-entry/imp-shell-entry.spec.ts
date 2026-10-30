import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpShellEntry } from './imp-shell-entry';

describe('ImpShellEntry', () => {
  let component: ImpShellEntry;
  let fixture: ComponentFixture<ImpShellEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpShellEntry],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpShellEntry);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
