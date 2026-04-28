if (!customElements.get('counter-up')) {
  class CounterUp extends HTMLElement {
    connectedCallback() {
      this.valueEl = this.querySelector('.counter-up__value');
      if (!this.valueEl) return;

      this.duration = (parseFloat(this.getAttribute('data-duration')) || 2) * 1000;
      this.hasPlayed = false;

      // Format the target as a localized string
      const target = parseFloat(this.getAttribute('data-target')) || 0;
      const targetStr = this.getAttribute('data-target') || '0';
      const decimalPart = targetStr.split('.')[1];
      const decimals = decimalPart ? decimalPart.length : 0;

      this.targetStr = decimals > 0 ? target.toFixed(decimals) : target.toLocaleString();

      // Check animation support (needs 1lh + overflow: clip)
      this.canAnimate = this.detectAnimationSupport();

      if (!this.canAnimate) {
        this.valueEl.textContent = this.targetStr;
        return;
      }

      // Build the digit tracks
      this.buildTracks();

      // Observe when element enters viewport
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this.hasPlayed) {
              this.hasPlayed = true;
              this.play();
              this.observer.disconnect();
            }
          });
        },
        { threshold: 0.2 }
      );

      this.observer.observe(this);
    }

    detectAnimationSupport() {
      try {
        if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
        return CSS.supports('height', '1lh') && CSS.supports('overflow', 'clip');
      } catch {
        return false;
      }
    }

    buildTracks() {
      let digitIndex = 0;
      const parts = [];

      for (const char of this.targetStr) {
        if (/\d/.test(char)) {
          const targetDigit = Number(char);
          const offset = digitIndex * 50;

          // For digit 0: scroll through 0-9 then back to 0
          // For other digits: scroll from 0 up to target digit
          let digits;
          if (targetDigit === 0) {
            digits = [...Array.from({ length: 10 }, (_, i) => i), 0];
          } else {
            digits = Array.from({ length: targetDigit + 1 }, (_, i) => i);
          }

          const steps = digits.length - 1;
          const digitSpans = digits
            .map((n) => '<span class="counter__digit">' + n + '</span>')
            .join('');

          parts.push(
            '<span class="counter__group">' +
              '<span class="counter__track" data-target="' + targetDigit + '"' +
              ' style="--counter-duration-offset: ' + offset + 'ms; --counter-steps: ' + steps + '">' +
              digitSpans +
            '</span>' +
            '</span>'
          );

          digitIndex++;
        } else {
          parts.push('<span class="counter__char">' + char + '</span>');
        }
      }

      this.valueEl.innerHTML = parts.join('');
      this.updateGroupWidths();
    }

    updateGroupWidths() {
      document.fonts.ready.then(() => {
        this.querySelectorAll('.counter__group').forEach((group) => {
          const track = group.querySelector('.counter__track');
          if (!track) return;
          const lastDigit = track.querySelector('.counter__digit:last-child');
          if (!lastDigit) return;
          const width = lastDigit.getBoundingClientRect().width || lastDigit.offsetWidth;
          if (!width) return;
          const fontSize = parseFloat(getComputedStyle(group).fontSize || '16');
          const widthInEm = width / (fontSize || 16);
          track.style.width = widthInEm + 'em';
        });
      });
    }

    play() {
      this.style.setProperty('--counter-duration', this.duration + 'ms');
      this.classList.add('is-playing');
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
    }
  }

  customElements.define('counter-up', CounterUp);
}
