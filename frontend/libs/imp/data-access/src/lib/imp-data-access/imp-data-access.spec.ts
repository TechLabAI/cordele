import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpDataAccess } from './imp-data-access';

describe('ImpDataAccess', () => {
  let component: ImpDataAccess;
  let fixture: ComponentFixture<ImpDataAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpDataAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpDataAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
