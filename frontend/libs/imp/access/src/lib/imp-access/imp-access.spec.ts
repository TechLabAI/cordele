import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImpAccess } from './imp-access';

describe('ImpAccess', () => {
  let component: ImpAccess;
  let fixture: ComponentFixture<ImpAccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImpAccess],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpAccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
