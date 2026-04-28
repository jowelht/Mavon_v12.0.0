if (!customElements.get('countdown-timer-evergreen')) {
  class CountdownTimerEvergreen extends HTMLElement {
    connectedCallback() {
      this.container = this.querySelector('.countdown-timer-inner');
      if (!this.container) return;

      const durationMs = parseInt(this.getAttribute('data-duration-ms'), 10);
      const blockId = this.getAttribute('data-block-id');

      if (!durationMs || durationMs <= 0) return;

      const storageKey = `countdown-evergreen-${blockId}`;
      let endTime = sessionStorage.getItem(storageKey);

      if (!endTime || parseInt(endTime, 10) <= Date.now()) {
        endTime = Date.now() + durationMs;
        sessionStorage.setItem(storageKey, endTime);
      } else {
        endTime = parseInt(endTime, 10);
      }

      this.endTime = endTime;
      this.runCountdown();
    }

    runCountdown() {
      const tick = () => {
        const timeDistance = this.endTime - Date.now();

        if (timeDistance <= 0) {
          this.renderTime(0, 0, 0, 0);
          clearInterval(this.interval);
          return;
        }

        const second = 1000;
        const minute = second * 60;
        const hour = minute * 60;
        const day = hour * 24;

        const days = Math.floor(timeDistance / day);
        const hours = Math.floor((timeDistance % day) / hour);
        const minutes = Math.floor((timeDistance % hour) / minute);
        const seconds = Math.floor((timeDistance % minute) / second);

        this.renderTime(days, hours, minutes, seconds);
      };

      tick();
      this.interval = setInterval(tick, 1000);
    }

    renderTime(days, hours, minutes, seconds) {
      const innerClasses = this.getAttribute('data-inner-classes') || '';
      const innerStyle = this.getAttribute('data-inner-style') || '';

      const item = (value, cssClass, label) =>
        `<div class="countdown-item ${cssClass}"><div class="countdown__inner"><span class="countdown__digit">${value}</span> <span class="countdown__labels">${label}</span></div></div>`;

      this.container.className = `countdown-timer-inner d-flex ${innerClasses}`.trim();
      this.container.setAttribute('style', innerStyle);
      this.container.innerHTML =
        item(days, 'Days', 'Days') +
        item(hours, 'Hrs', 'Hrs') +
        item(minutes, 'Min', 'Min') +
        item(seconds, 'Sec', 'Sec');
    }

    disconnectedCallback() {
      if (this.interval) clearInterval(this.interval);
    }
  }

  customElements.define('countdown-timer-evergreen', CountdownTimerEvergreen);
}
