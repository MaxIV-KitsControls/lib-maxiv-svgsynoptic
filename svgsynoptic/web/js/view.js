var View = (function () {

    function View (element, svg, maxZoom, zoomSteps) {

        maxZoom = maxZoom || 100;

        var svgMain = svg.select("#svg-main"),
            changeCallbacks = [];

        var width = parseInt(svg.attr("width")),
            height = parseInt(svg.attr("height"));

        console.log("SVG dimensiosn " + width +","+ height);
        
        var elWidth, elHeight, scale0;
        setSize();

        function zoomed() {
            svgMain.attr("transform", "translate(" + d3.event.translate +
                         ")scale(" + d3.event.scale + ")");
            updateDetailLevel(d3.event.scale);
            fireChangeCallbacks();
        }

        var zoomSel = svgMain.selectAll("g.zoom"),
            oldZoomLevel = -1,
            updateDetailLevel = _.throttle(_updateDetailLevel, 100,
                                           {leading: false});
        
        function _updateDetailLevel(scale) {

            var relScale = scale / scale0, zoomLevel;

            /* This is a primitive way to figure out at which scale
               we are.  Really need to make this configurable, since I
               can't see any way to make this completely general. */
            switch (true) {
            case relScale == 1:
                zoomLevel = 0;
                break;
            case relScale < 30:
                zoomLevel = 1;
                break;
            default:
                zoomLevel = 2;
            }

            if (zoomLevel != oldZoomLevel) {
                var levelClass = ".level" + zoomLevel;
                // ...and hide the old.
                zoomSel.filter(":not(" + levelClass + ")")
                    .classed("hidden", true)
                    .transition().duration(400)
                    .attr("opacity", 0)
                    .each("end", function () {
                        console.log("zoom opacity " + d3.select(this).attr("opacity"));
                        if (d3.select(this).attr("opacity") === 0) {
                            d3.select(this)
                                .classed("really-hidden", true);
                        }
                    });
                // Show the new zoomlevel...
                zoomSel.filter(levelClass)
                    .classed("hidden", false)
                    .classed("really-hidden", false)
                    .transition().duration(400)
                    .attr("opacity", 1);
                oldZoomLevel = zoomLevel;
            }
        }

        var zoom = d3.behavior.zoom()
                //.inertia(true)   // maybe d3 v3.6?
                .scaleExtent([scale0, 100*scale0])
                .on("zoom", zoomed);

        svg.call(zoom);

        element.appendChild(svg.node());

        setZoom({x: 0, y: 0, width: width, height: height});
        zoom.event(svg);

        // define the area to be visible
        function setZoom(bbox) {
            var scale = Math.min(elWidth / bbox.width, elHeight / bbox.height);
            scale = Math.min(scale, scale0 * maxZoom);
            var translate = [elWidth / 2 - scale * (bbox.x + bbox.width / 2),
                             elHeight / 2 - scale * (bbox.y + bbox.height / 2)];
            // testrect.attr(bbox);
            return zoom.scale(scale).translate(translate);
        }

        // smoothly pan and zoom the view to a given bounding box
        function moveToBBox(bbox, duration, padding) {
            duration = duration || 500;
            padding = padding || 0;
            var maxDim = Math.max(bbox.width, bbox.height),
                maxpadding = maxDim * padding,
                padded = {x: bbox.x - maxpadding,
                          y: bbox.y - maxpadding,
                          width: bbox.width + maxpadding * 2,
                          height: bbox.height + maxpadding * 2},
                z = setZoom(padded);
            svg.transition()
                .duration(duration)
                .ease("linear")
                .call(z.event);
        }
        this.moveToBBox = moveToBBox;

        var getViewBox = this.getViewBox = function () {
            var translate = zoom.translate(), scale = zoom.scale();
            return {
                x: -translate[0] / scale, y: -translate[1] / scale,
                width: elWidth / scale, height: elHeight / scale
            };
        };

        this.addCallback = function (cb) {
            changeCallbacks.push(cb);
        };

        function fireChangeCallbacks () {
            changeCallbacks.forEach(function (cb) {cb(getViewBox());});
        }

        function setSize() {
            // set some basic variables
            elWidth = element.offsetWidth;
            elHeight = element.offsetHeight;
            svg.attr("width", elWidth)
                .attr("height", elHeight);
            svg.attr("viewBox", "0 0 " +  elWidth + " " + elHeight);
            scale0 = Math.min(elWidth / width, elHeight / height);
        }

        function updateSize () {
            // Update sizes and scales when the window changes size
            var oldWidth = elWidth,
                oldScale = zoom.scale(),
                oldTrans = zoom.translate();
            setSize();
            var newScale = oldScale * elWidth / oldWidth;
            zoom.scale(newScale)
                .translate([oldTrans[0] * newScale / oldScale,
                            oldTrans[1] * newScale / oldScale])
                .scaleExtent([scale0, 100*scale0]);
            zoom.event(svg);
        }
        window.addEventListener("resize", updateSize);

    }

    return View;

})();
