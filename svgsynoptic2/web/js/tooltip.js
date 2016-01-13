var Tooltip = (function () {

    
    // A simple tooltip (info box that pops up under the mouse)
    function _Tooltip(element, view) {

        var tooltip = d3.select(element)
            .append("div")
            .classed("tooltip", true)
            .style("display", "none");
        
        function move () {
            // Crude attempt to make the tooltip fit on the screen... improve!
            if (d3.event.clientX > window.innerWidth/2) {
                tooltip
                    .style("left", d3.event.clientX - 10 - tooltip.node().clientWidth)
                    .style("top", d3.event.clientY + 10);
            } else {
                tooltip
                    .style("left", d3.event.clientX + 10)
                    .style("top", d3.event.clientY + 10);
            }
        };

        this.setHTML = function (html) {
            tooltip.html(html);
        }

        this.open = function () {
            tooltip.style("display", null);
            d3.select(window)
                .on("mousemove", move);
        }
        
        this.close = function () {
            tooltip.style("display", "none");
            d3.select(window).on("mousemove", null);
        };

    };

    return _Tooltip;

})();
