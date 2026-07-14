import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { CosmicContextMenuComponent } from './cosmic-context-menu.component';

describe('CosmicContextMenuComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CosmicContextMenuComponent]
    }).compileComponents();
  });

  it('clamps its measured dimensions inside the viewport', fakeAsync(() => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(320);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(500);

    const fixture = TestBed.createComponent(CosmicContextMenuComponent);
    const component = fixture.componentInstance;
    component.x = 315;
    component.y = 490;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.cosmic-context-menu') as HTMLElement;
    spyOn(menu, 'getBoundingClientRect').and.returnValue({
      width: 260,
      height: 400,
      x: 0,
      y: 0,
      top: 0,
      right: 260,
      bottom: 400,
      left: 0,
      toJSON: () => ({})
    });

    component.onViewportResize();
    tick(16);
    fixture.detectChanges();

    expect(component.displayX).toBe(50);
    expect(component.displayY).toBe(90);
    expect(menu.classList.contains('cosmic-context-menu--positioned')).toBeTrue();
  }));

  it('falls back to viewport padding when the measured menu exceeds the viewport', fakeAsync(() => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(280);
    spyOnProperty(window, 'innerHeight', 'get').and.returnValue(360);

    const fixture = TestBed.createComponent(CosmicContextMenuComponent);
    const component = fixture.componentInstance;
    component.x = 275;
    component.y = 355;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.cosmic-context-menu') as HTMLElement;
    spyOn(menu, 'getBoundingClientRect').and.returnValue({
      width: 400,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      right: 400,
      bottom: 600,
      left: 0,
      toJSON: () => ({})
    });

    component.onViewportResize();
    tick(16);

    expect(component.displayX).toBe(10);
    expect(component.displayY).toBe(10);
  }));

  it('keeps menu labels on one line inside the wider menu', fakeAsync(() => {
    const fixture = TestBed.createComponent(CosmicContextMenuComponent);
    fixture.componentInstance.quickTools = [{
      id: 'QUANTUM_SPLITTER',
      name: 'Quantum Splitter',
      desc: '',
      icon: '🌌'
    }];
    fixture.detectChanges();
    tick(16);

    const menu = fixture.nativeElement.querySelector('.cosmic-context-menu') as HTMLElement;
    const item = fixture.nativeElement.querySelector('[role="menuitemradio"]') as HTMLElement;
    const label = item.querySelector('span:last-child') as HTMLElement;

    expect(getComputedStyle(item).boxSizing).toBe('border-box');
    expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
    expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(menu.getBoundingClientRect().right);
    expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
  }));
});
