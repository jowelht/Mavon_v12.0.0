theme.headerMainMenuModule = (function () {
  function mainMenu(e) {
    let headerWrapper = e.querySelector(".header_bottom");
    let menuLiSelector = document.querySelectorAll(".header__menu_li");
    const menuDisplayType = e.dataset.menuDisplay; // 'click' or 'hover'
    const menuDisplayDelay = parseFloat(e.dataset.menuDisplayDelay) * 1000 || 0; // Convert to milliseconds

    menuLiSelector.forEach((item) => {
      if (item.classList.contains("menu__item_has_children")) {
        let menuItemUrl = "";
        let menuItemLocation = "";
        let hoverTimeout = null; // Store timeout ID for clearing

        if (menuDisplayType === "hover") {
          // HOVER MODE
          item.addEventListener("mouseover", (event) => {
            // Clear any existing timeout
            if (hoverTimeout) {
              clearTimeout(hoverTimeout);
            }

            // Apply delay before opening menu
            hoverTimeout = setTimeout(() => {
              let listDetails = item.querySelector("details");
              listDetails.setAttribute("open", "");
              item.querySelector("summary").setAttribute("aria-expanded", true);
              headerWrapper.classList.add("mega--menu-open");
            }, menuDisplayDelay);
          });

          item.addEventListener("mouseleave", (event) => {
            // Clear pending timeout
            if (hoverTimeout) {
              clearTimeout(hoverTimeout);
              hoverTimeout = null;
            }

            // Immediately close menu
            let listDetails = item.querySelector("details");
            listDetails.removeAttribute("open");
            item.querySelector("summary").setAttribute("aria-expanded", false);
            headerWrapper.classList.remove("mega--menu-open");
          });

          // Click navigates to URL in hover mode
          item.querySelector("summary").addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            menuItemUrl = item.querySelector("summary").dataset.href;
            if (menuItemUrl) {
              location.href = menuItemUrl;
            }
          });

        } else if (menuDisplayType === "click") {
          // CLICK MODE
          // Remove hover effects in click mode
          item.addEventListener("mouseover", (event) => {
            event.preventDefault();
          });

          item.addEventListener("mouseleave", (event) => {
            event.preventDefault();
          });

          // Toggle menu on click
          item.querySelector("summary").addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            let listDetails = item.querySelector("details");
            let isOpen = listDetails.hasAttribute("open");
            
            if (isOpen) {
              // Menu is open - navigate to URL
              menuItemUrl = item.querySelector("summary").dataset.href;
              if (menuItemUrl) {
                location.href = menuItemUrl;
              }
            } else {
              // Menu is closed - open it
              listDetails.setAttribute("open", "");
              item.querySelector("summary").setAttribute("aria-expanded", true);
              headerWrapper.classList.add("mega--menu-open");
            }
          });

          // Close menu when clicking outside
          document.addEventListener("click", (event) => {
            if (!item.contains(event.target)) {
              let listDetails = item.querySelector("details");
              listDetails.removeAttribute("open");
              item.querySelector("summary").setAttribute("aria-expanded", false);
              headerWrapper.classList.remove("mega--menu-open");
            }
          });
        }
      }
    });
  }
  return mainMenu;
})();
