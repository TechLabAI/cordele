import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpUi } from './imp-ui';

describe('ImpUi', () => {
  let component: ImpUi;
  let fixture: ComponentFixture<ImpUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpUi],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpUi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
