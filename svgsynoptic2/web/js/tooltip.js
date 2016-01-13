var Tooltip = (function () {

    
    // A simple tooltip (info box that pops up under the mouse)
    // Relies on the backend to fill it with something.
    function _Tooltip(element, view) {

        var tooltip = document.createElement("div");
        tooltip.classList.add("tooltip");
        tooltip.style.display = "none";
        element.appendChild(tooltip);
        
        function move (event) {
            
            //Crude attempt to make the tooltip fit on the screen... improve!
            if (event.clientX > window.innerWidth/2) {
                tooltip.style.left = (event.clientX - 10 - tooltip.clientWidth) + "px";
                tooltip.style.top = (event.clientY + 10) + "px";
            } else {
                tooltip.style.left = (event.clientX + 10) + "px";
                tooltip.style.top = (event.clientY + 10) + "px";
            }
        };

        this.setHTML = function (html) {
            tooltip.innerHTML = html;
        }

        this.open = function () {
            window.addEventListener("mousemove", move);
            tooltip.style.display = null;
        }
        
        this.close = function () {
            tooltip.style.display = "none";
            window.removeEventListener("mousemove", move);
        };

        // close the tooltip if the user moves the view?
        //view.addCallback(_.debounce(close, 500, {leading: true});

    };

    return _Tooltip;

})();
