theme.footerSection = (function(){
  function footer(){
    let accordion = true;
    
    const footerWidgetAccordion = function () {
      accordion = false;
      
      // Check if elements exist before adding event listeners
      const toggleElements = document.querySelectorAll(".footer__widget_toggle");
      if (!toggleElements.length) {
        console.warn('No .footer__widget_toggle elements found');
        return;
      }
      
      toggleElements.forEach(function (item) {
        if (!item) return;
        
        item.addEventListener('click', function (e) {
          e.preventDefault();
          
          const footerWidget = this.closest('.footer__widget');
          if (!footerWidget) {
            console.warn('No .footer__widget parent found');
            return;
          }
          
          const footerWidgetInner = footerWidget.querySelector('.footer__widget_inner');
          if (!footerWidgetInner) {
            console.warn('No .footer__widget_inner found');
            return;
          }
          
          if (footerWidget.classList.contains('active')) {
            footerWidget.classList.remove('active');
            slideUp(footerWidgetInner);
          } else {
            footerWidget.classList.add('active');
            slideDown(footerWidgetInner);
            
            // Close sibling widgets
            const parentElement = footerWidget.parentElement;
            if (parentElement) {
              getSiblings(parentElement).forEach(function (item) {
                if (!item) return;
                
                const siblingFooterWidget = item.querySelector('.footer__widget');
                const siblingFooterWidgetInner = item.querySelector('.footer__widget_inner');
                
                if (siblingFooterWidget && siblingFooterWidgetInner) {
                  siblingFooterWidget.classList.remove('active');
                  slideUp(siblingFooterWidgetInner);
                }
              });
            }
          }
        });
      });
    };
    
    // Initialize accordion if needed
    if (accordion) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', footerWidgetAccordion);
      } else {
        footerWidgetAccordion();
      }
    }
    
    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function () {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        const footerWidgets = document.querySelectorAll('.footer__widget');
        
        footerWidgets.forEach(function (item) {
          if (!item) return;
          
          const footerWidgetInner = item.querySelector('.footer__widget_inner');
          
          if (window.outerWidth >= 768) {
            item.classList.remove('active');
            if (footerWidgetInner) {
              footerWidgetInner.style.display = '';
            }
          }
        });
        
        // Reinitialize accordion if needed
        if (accordion) {
          footerWidgetAccordion();
        }
      }, 250);
    });
  }
  
  return footer;
})();