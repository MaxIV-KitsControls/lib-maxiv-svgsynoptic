var Tooltip = (function () {

    
    // A simple tooltip (info box that pops up under the mouse)
    // Relies on the backend to fill it with something.
    function _Tooltip(element, view, svg) {

        var tooltip = document.createElement("div");
        tooltip.classList.add("tooltip");
        tooltip.style.display = "none";
        element.appendChild(tooltip);

        util.forEach(
            svg.querySelectorAll(".section, .model"),
            function (node) {
                node.addEventListener("mouseover", function (event) {
                    open(node);
                });
                node.addEventListener("mouseout", function (d) {
                    close();
                });
            });

        // follow the mouse movements
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

        var setHTML = this.setHTML = function (html) {
            tooltip.innerHTML = html;
        };

        var updater;
        // show the tooltip and update its content periodically
        var open = this.open = function (node) {
            update(node);
            if (!updater)
                updater = setInterval(function () {update(node);}, 1000);
            window.addEventListener("mousemove", move);
            tooltip.style.display = null;
        };

        // hide the tooltip and stop the updates
        var close = this.close = function () {
            tooltip.style.display = "none";
            window.removeEventListener("mousemove", move);
            var _updater = updater;
            updater = null;
            clearInterval(_updater);
        };

        // Set the text of the tooltip according to the data on the node
        function update(node) {
            var content = "(Unknown)";
            if (node.dataset.model) {
                content = '<div class="model">' + node.dataset.model + "</div>";
                if (node.dataset.value) {
                    content += '<span class="value">' + node.dataset.value + "</span>";
                }
                if (node.dataset.quality) {
                    content += " [" + node.dataset.quality + "]";
                }                
            } else if (node.dataset.section) {
                content = node.dataset.section;
            }
            setHTML(content);
        }
        
        // close the tooltip if the user moves the view?
        view.addCallback(_.debounce(close, 500, {leading: true}));

    };

    return _Tooltip;

})();
