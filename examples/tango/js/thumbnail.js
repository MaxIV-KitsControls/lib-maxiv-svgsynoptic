/*
The Thumbnail provides a small overview of the whole synoptic in 
the lower right corner. The thumbnail indicates the part currently
viewed and allows the user to click a location in order to move
the view there.
*/

Thumbnail = (function () {

    function _Thumbnail(container, view, svg, config) {

        config = config || {};
        
        var outer = d3.select(container)
            .append("div")
            .classed("thumbnail", true);

        // allow the user to configure the size of the thumbnail.
        // Note that only the height can be set. Seems more likely that users
        // will enlarge the window horizontally, so it's more important that the
        // thumbnail does not grow huge then. But the logic is still lacking,
        // we should perhaps limit the *area* of the thumbnail instead?
        if (config.size) {
            outer.style("height", config.size);
        } else {
            outer.style("height", "20%");
        }
        
        var inner = outer.append("div")
            .classed("inner", true);

        var indicator = inner.append("div")
            .classed("indicator", true);

        var thumb = svg; //d3.select(svg.node().cloneNode(true));
        // Only show the lowest detail level in the thumbnail
        thumb.selectAll(".layer .zoom")
            .style("display", "none");
        thumb.select("#background g.zoom.level0")
            .style("display", "inline");        

        var toggle = d3.select(container)
            .append("div")
            .classed("thumbnail-toggle", true)
            .text("-")
            .attr("title", "Hide/show thumbnail")
        
        var width = thumb.attr("width"),
            height = thumb.attr("height"),
            aspect = width / height,
            inner_width = inner.node().offsetWidth,
            scale = width / inner_width;
        
        inner.node().appendChild(thumb.node());

        // re-center the view on click
        function panTo() {
            view.moveTo({x: d3.event.layerX * scale,
                         y: d3.event.layerY * scale}, 200);
        };
        thumb.on("click", panTo);

        // indicate the current view box
        function updateIndicator(bbox) {
            indicator
                .style("left", bbox.x / scale)
                .style("top", bbox.y / scale)
                .style("width", bbox.width / scale)
                .style("height", bbox.height / scale)            
        }
        updateIndicator(view.getViewBox());
        view.addCallback(updateIndicator);
                
        // update thumbnail size when window geometry changes
        function updateSize () {
            var inner_height = inner.node().offsetHeight,
                inner_width = inner_height * aspect;
            thumb.attr("viewBox", "0 0 " + width + " " + height)
                .attr("width", inner_width)
                .attr("height", inner_height);
            inner.style("width", inner_width);
            scale = width / inner_width;
            updateIndicator(view.getViewBox());
        }
        updateSize();
        window.addEventListener("resize", updateSize);

        function toggleVisibility () {
            var isInvisible = toggle.classed("invisible");
            outer.style("visibility", isInvisible? "visible" : "hidden")
            toggle
                .classed("invisible", !isInvisible)
                .text(isInvisible? "-" : "+")

        }
        toggle.on("click", toggleVisibility);
        
    }

    return _Thumbnail;
    
})();
