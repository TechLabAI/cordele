import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpFeatureUpload } from './imp-feature-upload';

describe('ImpFeatureUpload', () => {
  let component: ImpFeatureUpload;
  let fixture: ComponentFixture<ImpFeatureUpload>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpFeatureUpload],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpFeatureUpload);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
