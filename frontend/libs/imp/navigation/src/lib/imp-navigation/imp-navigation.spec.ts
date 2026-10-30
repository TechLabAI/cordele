import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpNavigation } from './imp-navigation';

describe('ImpNavigation', () => {
  let component: ImpNavigation;
  let fixture: ComponentFixture<ImpNavigation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpNavigation],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpNavigation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
