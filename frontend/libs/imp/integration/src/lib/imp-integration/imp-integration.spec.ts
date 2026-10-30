import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpIntegration } from './imp-integration';

describe('ImpIntegration', () => {
  let component: ImpIntegration;
  let fixture: ComponentFixture<ImpIntegration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpIntegration],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpIntegration);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
