var View = (function () {

    // calculate the largest scale at which the whole image fits in
    // the window
    function fitImageInWindow(windowWidth, windowHeight,
                              imageWidth, imageHeight) {
        var windowRatio = windowWidth / windowHeight,
            imageRatio = imageWidth / imageHeight;
        if (windowRatio < imageRatio) {
            return windowWidth / imageWidth;                
        }
        return windowHeight / imageHeight;                        
    }
    
    function View (element, svg, config) {

        /* config.zoomSteps is a list of numbers. The first number
           determines at which scale (relative to full view) we switch
           from detail level 0 to 1, and so on. Setting the first
           number to 1 means that the lowest detail level is only used
           when fully zoomed out, showing the whole picture.  The end
           points of zoomSteps also limits user zooming.  If the
           number of steps is smaller than the number of zoom levels
           in the SVG, those higher zoom levels will not be visible. */
        
        config = config || {};
        var zoomSteps = config.zoomSteps || [1, 10, 100],
            maxZoom = zoomSteps.slice(-1)[0];

        var svgMain = svg.select("svg > g"),  // the toplevel group
            zoomSel = svgMain.selectAll("g.zoom");  // all zoom levels
        
        // setup the mouse pan/zoom behavior
        var zoom = d3.behavior.zoom().on("zoom", function() {
            svgMain.attr("transform",
                         "translate(" + d3.event.translate + ")" +
                         " scale(" + d3.event.scale + ")");
            oldScale = d3.event.scale;
            oldTranslate = d3.event.translate;            
            updateZoomLevel(d3.event.scale);
            fireChangeCallbacks();
        });
        svg.call(zoom);

        // update the zoom levels to that the one that corresponds to
        // the current scale is visible
        var updateZoomLevel = _.throttle(function (scale) {
            var relativeScale = scale / minimumScale, zoomLevel;
            /* This is a primitive way to switch zoom level.
               Can't see a way to make this completely general
               so for now it must be configured manually. */
            for(var i = 0; i<zoomSteps.length; i++) {
                var z = zoomSteps[i];
                if (z >= relativeScale) {
                    zoomLevel = i;
                    break;
                }
                zoomLevel = i;  // never go beyond the highest level
            }
            if (zoomLevel != oldZoomLevel) {
                var levelClass = ".level" + zoomLevel;
                // hide the old zoom level...
                zoomSel.filter(":not(" + levelClass + ")")
                    .classed("hidden", true)
                    .transition().duration(400)
                    .attr("opacity", 0)
                    .each("end", function () {
                        // ouch... there must be a better way to do this :)
                        if (d3.select(this).attr("opacity") === 0) {
                            d3.select(this)
                                .classed("really-hidden", true);
                        }
                    });
                // ...and show the new
                zoomSel.filter(levelClass)
                    .classed({"hidden": false, "really-hidden": false})
                    .transition().duration(400)
                    .attr("opacity", 1);
                oldZoomLevel = zoomLevel;
            }            
        }, 100, {leading: false});

        // define the area to be visible
        function setZoom(bbox) {
            var elWidth = element.clientWidth,
                elHeight = element.clientHeight;
            var scale = Math.min(elWidth / bbox.width, elHeight / bbox.height);
            scale = Math.min(scale, minimumScale * maxZoom);
            var translate = [elWidth / 2 - scale * (bbox.x + bbox.width / 2),
                             elHeight / 2 - scale * (bbox.y + bbox.height / 2)];
            return zoom.scale(scale).translate(translate);
        }

        // add the SVG to the page
        console.log(element);
        element.appendChild(svg.node());
        
        // reset the SVG view related attributes
        var bbox = svg.node().getBoundingClientRect(),
            svgWidth = bbox.width, svgHeight = bbox.height;
        svg.attr("viewBox", null)
            .attr("width", "100%")
            .attr("height", "100%");

        var minimumScale = 1, oldZoomLevel;

        // make sure the image fits within the initial size of the window
        // setTimeout(function () {
        minimumScale = fitImageInWindow(element.clientWidth,
                                        element.clientHeight,
                                        svgWidth, svgHeight);
        zoom.scale(minimumScale)
            .scaleExtent([minimumScale, minimumScale*maxZoom]);

        // });

        // get the current view box
        var getViewBox = this.getViewBox = function () {
            var translate = zoom.translate(), scale = zoom.scale();
            return {
                width: element.clientWidth / scale,
                height: element.clientHeight / scale,
                x: -parseFloat(translate[0] / scale),
                y: -parseFloat(translate[1] / scale)
            };
        };
        
        // update the view if the window size changes
        var oldWidth = element.clientWidth,
            oldScale = minimumScale,
            oldTranslate = [0, 0];
        window.addEventListener("resize", function () {
            minimumScale = fitImageInWindow(element.clientWidth,
                                            element.clientHeight,
                                            svgWidth, svgHeight);
            zoom.scaleExtent([minimumScale,
                              minimumScale * maxZoom]);
            // TODO: figure out a better way, right now we only take
            // the window width into account when calculating the new
            // scale.
            var newScale = oldScale * element.clientWidth / oldWidth;
            zoom.scale(newScale)
                .translate([oldTranslate[0] * newScale / oldScale,
                            oldTranslate[1] * newScale / oldScale])
                .scaleExtent([minimumScale, maxZoom*minimumScale]);
            zoom.event(svg);

            oldWidth = element.clientWidth;
            oldScale = zoom.scale();
            oldTranslate = zoom.translate();   
        });
                
        // handle user callbacks
        var changeCallbacks = [];
        function fireChangeCallbacks () {
            changeCallbacks.forEach(function (cb) {cb(getViewBox());});
        }

        window.addEventListener("keydown", function (ev) {

            var bbox;
            
            switch(ev.keyCode) {

            case 32:  // space; reset the view
                resetView();
                break;                

            case 37:  // left arrow key
                panViewBy(.25, 0);
                break;
            case 39:  // right arrow key
                panViewBy(-.25, 0);
                break;
                
            case 38:  // up arrow key
                panViewBy(0, .25);
                break;                
            case 40:  // down arrow key
                panViewBy(0, -.25);
                break;

            case 187:  // plus
                bbox = getViewBox();                
                moveToBBox({
                    x: bbox.x + bbox.width/6,
                    y: bbox.y + bbox.height/6,
                    width: bbox.width/1.5, height: bbox.height/1.5
                });
                break;
            case 189:  // minus
                bbox = getViewBox();                
                moveToBBox({
                    x: bbox.x - bbox.width/4,
                    y: bbox.y - bbox.height/4,
                    width: bbox.width * 1.5, height: bbox.height * 1.5
                });
                break;
            }
        });
        
        // ----- external API methods -----

        // add a callback function that will get run every time
        // the view changes
        this.addCallback = function (cb) {
            changeCallbacks.push(cb);
            // send out a first event immediately
            setTimeout(function () {cb(getViewBox());});
        };

        // check if a given rectangle is within view
        this.isInView = function (bbox) {
            var vbox = getViewBox(),
                width = bbox.width || 0, height = bbox.height || 0;
            return (bbox.x > vbox.x - width  &&
                    bbox.y > vbox.y - height &&
                    bbox.x < vbox.x + vbox.width &&
                    bbox.y < vbox.y + vbox.height);
        };

        // set the view to show a given viewbox
        var moveToBBox = this.moveToBBox = function (bbox, duration, padding) {
            padding = padding || 0;
            var maxDim = Math.max(bbox.width, bbox.height),
                maxpadding = maxDim * padding,
                padded = {x: (bbox.x || 0) - maxpadding,
                          y: (bbox.y || 0) - maxpadding,
                          width: bbox.width + maxpadding * 2,
                          height: bbox.height + maxpadding * 2};
            setZoom(padded);
            if (duration) {
                svg.transition()
                    .duration(duration)
                    .ease("linear")
                    .call(zoom.event);
            } else {
                svg.call(zoom.event);
            }            
        };

        // smoothly pan the view to center on a coordinate
        this.moveTo = function moveTo(coord, duration) {
            var bbox = getViewBox(),
                padded = {x: coord.x - bbox.width/2,
                          y: coord.y - bbox.height/2,
                          width: bbox.width,
                          height: bbox.height};
            setZoom(padded);
            if (duration) {
                svg.transition()
                    .duration(duration)
                    .ease("linear")
                    .call(zoom.event);
            } else {
                svg.call(zoom.event);
            }
        };

        // pan the view by an amount relative to the size of the screen
        var panViewBy = this.panBy = function (dx, dy) {
            var bbox = getViewBox();
            moveToBBox({
                x: bbox.x - bbox.width * dx, y: bbox.y - bbox.height * dy,
                width: bbox.width, height: bbox.height
            });            
        };

        // reset the view to show the whole picture
        var resetView = this.reset = function () {
            moveToBBox({x: 0, y: 0, width: svgWidth, height: svgHeight});
        };
        
    }
    
    return View;
        
})();
