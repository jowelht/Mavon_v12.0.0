if (!customElements.get('accordion-group')) {
  class AccordionGroup extends HTMLElement {
    get behavior() {
      return this.getAttribute('data-open-behavior') || 'multiple';
    }

    closeOthers(openedRow) {
      if (this.behavior !== 'single') return;
      this.querySelectorAll('accordion-custom').forEach((row) => {
        if (row !== openedRow && row.details && row.details.open) {
          row.close();
        }
      });
    }
  }
  customElements.define('accordion-group', AccordionGroup);
}

if (!customElements.get('accordion-custom')) {
  class AccordionCustom extends HTMLElement {
    connectedCallback() {
      this.summary = this.querySelector('summary');
      this.details = this.querySelector('details');
      this.content = this.querySelector('.accordion-row__content');
      this.animation = null;

      if (this.summary && this.content) {
        this.summary.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.animation) this.animation.cancel();
          if (this.details.open) {
            this.close();
          } else {
            this.open();
          }
        });
      }
    }

    open() {
      // Capture collapsed height BEFORE opening
      const startHeight = this.details.offsetHeight + 'px';

      // Open to make content measurable
      this.details.open = true;
      this.details.style.overflow = 'hidden';

      // Measure expanded height
      const endHeight = this.details.scrollHeight + 'px';

      this.animation = this.details.animate(
        { height: [startHeight, endHeight] },
        { duration: 300, easing: 'ease-out' }
      );

      this.animation.onfinish = () => {
        this.details.style.height = '';
        this.details.style.overflow = '';
        this.animation = null;
      };

      this.animation.oncancel = () => {
        this.details.style.height = '';
        this.details.style.overflow = '';
        this.animation = null;
      };

      // Notify parent group to close siblings
      const group = this.closest('accordion-group');
      if (group) group.closeOthers(this);
    }

    close() {
      const startHeight = this.details.offsetHeight + 'px';
      const endHeight = this.summary.offsetHeight + 'px';

      this.details.style.overflow = 'hidden';

      this.animation = this.details.animate(
        { height: [startHeight, endHeight] },
        { duration: 300, easing: 'ease-out' }
      );

      this.animation.onfinish = () => {
        this.details.open = false;
        this.details.style.height = '';
        this.details.style.overflow = '';
        this.animation = null;
      };

      this.animation.oncancel = () => {
        this.details.style.height = '';
        this.details.style.overflow = '';
        this.animation = null;
      };
    }
  }
  customElements.define('accordion-custom', AccordionCustom);
}
