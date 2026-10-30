import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpFeatureReview } from './imp-feature-review';

describe('ImpFeatureReview', () => {
  let component: ImpFeatureReview;
  let fixture: ComponentFixture<ImpFeatureReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpFeatureReview],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpFeatureReview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
