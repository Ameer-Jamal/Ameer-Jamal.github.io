import { Component, OnInit, OnDestroy } from '@angular/core';
import { playSpaceshipLaunch, playSupernovaPop } from '../background-canvas/engine/audio';
import { AYA_CONFIG } from '../background-canvas/engine/aya-easter-egg';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  templateUrl: './contact-section.component.html',
  styleUrl: './contact-section.component.scss'
})
export class ContactSectionComponent implements OnInit, OnDestroy {
  formState: 'idle' | 'submitting' | 'success' | 'error' = 'idle';
  errorMessage = '';
  particles: Array<{ tx: number; ty: number; size: number; color: string; delay: number }> = [];
  private trailInterval: any = null;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      (window as any).submitAndResetForm = () => this.submitAndResetForm();
    }
  }

  ngOnDestroy(): void {
    this.stopSpaceshipTrail();
    if (this.closeTimeoutId) clearTimeout(this.closeTimeoutId);
    if (this.fadeTimeoutId) clearTimeout(this.fadeTimeoutId);
  }

  handleSubmit(event: Event): void {
    event.preventDefault();
    this.submitAndResetForm();
  }

  async submitAndResetForm(): Promise<void> {
    if (typeof document === 'undefined' || this.formState === 'submitting') {
      return;
    }

    const nameEl = document.getElementById('name') as HTMLInputElement | null;
    const emailEl = document.getElementById('email') as HTMLInputElement | null;
    const messageEl = document.getElementById('message') as HTMLTextAreaElement | null;
    const formEl = document.getElementById('contactForm') as HTMLFormElement | null;

    const nameVal = nameEl ? nameEl.value.trim().toLowerCase() : '';
    const emailVal = emailEl ? emailEl.value.trim().toLowerCase() : '';
    const messageVal = messageEl ? messageEl.value.trim().toLowerCase() : '';

    if (nameVal === AYA_CONFIG.trigger.name && emailVal === AYA_CONFIG.trigger.email && messageVal === AYA_CONFIG.trigger.message) {
      this.closeContact();
      if (typeof window !== 'undefined' && typeof (window as any).__triggerAyaEasterEgg === 'function') {
        (window as any).__triggerAyaEasterEgg();
      }
      if (nameEl) nameEl.value = '';
      if (emailEl) emailEl.value = '';
      if (messageEl) messageEl.value = '';
      return;
    }

    if (!formEl) return;

    if (!nameEl?.value.trim() || !emailEl?.value.trim() || !messageEl?.value.trim()) {
      this.errorMessage = 'Please fill in all fields.';
      this.formState = 'error';
      setTimeout(() => { if (this.formState === 'error') this.formState = 'idle'; }, 3000);
      return;
    }

    this.formState = 'submitting';
    this.errorMessage = '';

    try {
      const formData = new FormData(formEl);
      const response = await fetch('https://formspree.io/f/xnqypvyy', {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        if (nameEl) nameEl.value = '';
        if (emailEl) emailEl.value = '';
        if (messageEl) messageEl.value = '';

        this.particles = Array.from({ length: 20 }, () => ({
          tx: (Math.random() - 0.5) * 300,
          ty: (Math.random() - 0.5) * 300 - 40,
          size: 3 + Math.random() * 5,
          color: (['#64b5f6', '#4fc3f7', '#81d4fa', '#b3e5fc', '#ffffff'] as const)[Math.floor(Math.random() * 5)],
          delay: Math.random() * 0.35
        }));

        this.formState = 'success';

        const contactEl = document.getElementById('contact');
        if (contactEl) {
          contactEl.classList.add('is-morphing');
          document.body.classList.add('is-contact-morphing');

          // Force a style flush so the browser sees the pre-launch state, then start
          // the animation synchronously instead of waiting on requestAnimationFrame.
          void contactEl.offsetHeight;
          if (contactEl.classList.contains('is-morphing')) {
            contactEl.classList.add('is-ship');
            this.startSpaceshipTrail();
          }
          
          // Play launch engine synthesized sound
          playSpaceshipLaunch();

          // Trigger ignition poof explosion at 0.4s (as it starts its upward flight)
          setTimeout(() => {
            this.triggerBlastoffPoof();
          }, 400);
        }

        // Fade the shell just before the flight completes so the exit reads as one motion.
        this.fadeTimeoutId = setTimeout(() => {
          if (contactEl) {
            contactEl.classList.add('is-closing-launch');
          }
        }, 4125);

        // Close after 4.5s flight completes
        this.closeTimeoutId = setTimeout(() => {
          this.closeContact();
          
          if (contactEl) {
            contactEl.classList.remove('is-closing-launch');
            contactEl.classList.remove('is-morphing');
            contactEl.classList.remove('is-ship');
          }
          document.body.classList.remove('is-contact-morphing');
          this.stopSpaceshipTrail();

          setTimeout(() => { this.formState = 'idle'; }, 600);
        }, 4500);
      } else {
        const data = await response.json().catch(() => ({ error: 'Submission failed.' }));
        this.errorMessage = data.error || 'Something went wrong. Please try again.';
        this.formState = 'error';
        setTimeout(() => { if (this.formState === 'error') this.formState = 'idle'; }, 4000);
      }
    } catch {
      this.errorMessage = 'Network error. Please check your connection.';
      this.formState = 'error';
      setTimeout(() => { if (this.formState === 'error') this.formState = 'idle'; }, 4000);
    }
  }

  private closeContact(): void {
    if (typeof window === 'undefined') return;
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  private startSpaceshipTrail(): void {
    if (typeof document === 'undefined') return;

    const colors = ['#00f0ff', '#0072ff', '#ffffff', '#ff00a0', '#ab47bc'];
    const spawnParticle = () => {
      if (!document.getElementById('contact')?.classList.contains('is-morphing')) {
        return;
      }

      const shipEl = document.querySelector('.spaceship-wrapper') as HTMLElement | null;
      const rect = shipEl?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0 || rect.top < -200 || rect.top > window.innerHeight + 200) {
        return;
      }

      // Engines are at the bottom of the vertically-pointing ship
      const x = rect.left + rect.width / 2;
      const y = rect.bottom - 15;

      const count = Math.random() > 0.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'spaceship-trail-particle';
        
        const size = 3 + Math.random() * 5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        p.style.position = 'fixed';
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.borderRadius = '50%';
        p.style.background = color;
        p.style.boxShadow = `0 0 10px ${color}`;
        p.style.pointerEvents = 'none';
        p.style.zIndex = '99999';
        
        document.body.appendChild(p);

        // Exhaust ejects downwards (opposite of the upward flight direction)
        const tx = (Math.random() - 0.5) * 20; 
        const ty = 35 + Math.random() * 50; 

        p.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
        ], {
          duration: 500 + Math.random() * 400,
          easing: 'ease-out'
        });

        setTimeout(() => p.remove(), 1000);
      }
    };

    this.trailInterval = setInterval(spawnParticle, 30);
  }

  private stopSpaceshipTrail(): void {
    if (this.trailInterval) {
      clearInterval(this.trailInterval);
      this.trailInterval = null;
    }
  }

  private triggerBlastoffPoof(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const shipEl = document.querySelector('.spaceship-wrapper') as HTMLElement | null;
    const rect = shipEl?.getBoundingClientRect();
    
    // Fallback to bottom center of screen if rect is not ready
    const centerX = rect ? (rect.left + rect.width / 2) : (window.innerWidth / 2);
    const centerY = rect ? rect.bottom : (window.innerHeight - 80);
    const colors = ['#00f0ff', '#0072ff', '#ffffff', '#ff00a0', '#ffd700'];

    for (let i = 0; i < 50; i++) {
      const p = document.createElement('div');
      p.className = 'spaceship-explosion-particle';
      
      const size = 4 + Math.random() * 6;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      p.style.position = 'fixed';
      p.style.left = `${centerX}px`;
      p.style.top = `${centerY}px`;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;
      p.style.borderRadius = '50%';
      p.style.background = color;
      p.style.boxShadow = `0 0 12px ${color}`;
      p.style.pointerEvents = 'none';
      p.style.zIndex = '99999';
      
      document.body.appendChild(p);

      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 160;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      p.animate([
        { transform: 'translate(0, 0) scale(1.5)', opacity: 1 },
        { transform: `translate(${tx}px, ${ty}px) scale(0)`, opacity: 0 }
      ], {
        duration: 800 + Math.random() * 500,
        easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
      });

      setTimeout(() => p.remove(), 1400);
    }
  }
}
