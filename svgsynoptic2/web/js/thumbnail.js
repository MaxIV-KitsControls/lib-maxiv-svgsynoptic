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
        
        if (config.size)
            outer.style("width", config.size);

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
            var inner_width = inner.node().offsetWidth,
                inner_height = inner_width / aspect;
            thumb.attr("viewBox", "0 0 " + width + " " + height)
                .attr("width", inner_width)
                .attr("height", inner_height);
            inner.style("height", inner_height);
            scale = width / inner_width;
            updateIndicator(view.getViewBox());
        }
        updateSize();
        window.addEventListener("resize", updateSize);
    }

    return _Thumbnail;
    
})();
