/*
The View is an interactive container for an SVG document.  

It can be configured to switch between detail levels in the document
depending on the current zoom level.

Also provides some convenience methods for quickly moving the
virwpoint to a given item, etc.
*/

var View = (function () {

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
        zoomSteps = config.zoomSteps || [1, 10, 100];
        var maxZoom = zoomSteps.slice(-1)[0];

        // assume everything is contained in one toplevel group
        // TODO: is this really necessary?
        var svgMain = svg.select("g"),
            changeCallbacks = [];

        // Figure out the original size of the drawing.
        // TODO: what's correct to use here? Looks like the
        // width/height attrs of the SVG can be completely wrong in
        // inkscape files at least. Is viewBox reliable?
        var viewBox = svg.attr("viewBox");
        if (viewBox) {
            viewBox = viewBox.split(" ");
            width = viewBox[2], height = viewBox[3];
        } else {
            var width = parseInt(svg.attr("width")),
                height = parseInt(svg.attr("height"));
        }
        console.log("width " + width + ", height: " + height);

        var originalTransform = d3.transform(svgMain.attr("transform"));
        console.log("originalTransform: " + originalTransform)
        
        // svgMain.attr("transform", null);

        var elWidth, elHeight, scale0;
        setSize();
        
        function _updateDetailLevel(scale) {
            var relScale = scale / scale0, zoomLevel;

            /* This is a primitive way to switch zoom level.
               Can't see a way to make this completely general
               so for now it must be configured manually. */
            for(var i = 0; i<zoomSteps.length; i++) {
                var z = zoomSteps[i];
                if (z >= relScale) {
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
        }

        function zoomed() {
            svgMain.attr("transform", "translate(" + d3.event.translate +
                         ")scale(" + d3.event.scale + ")"
                         + originalTransform.toString());
            updateDetailLevel(d3.event.scale);
            fireChangeCallbacks();
        }

        var zoomSel = svgMain.selectAll("g.zoom"), oldZoomLevel = -1,
            updateDetailLevel = _.throttle(_updateDetailLevel, 100,
                                           {leading: false});
        
        var zoom = d3.behavior.zoom()
                //.inertia(true)   // maybe d3 v3.6?
                .scaleExtent([scale0, scale0*maxZoom])
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
            padding = padding || 0;
            var maxDim = Math.max(bbox.width, bbox.height),
                maxpadding = maxDim * padding,
                padded = {x: bbox.x - maxpadding,
                          y: bbox.y - maxpadding,
                          width: bbox.width + maxpadding * 2,
                          height: bbox.height + maxpadding * 2},
                z = setZoom(padded);
            if (duration) {
                svg.transition()
                    .duration(duration)
                    .ease("linear")
                    .call(z.event);
            } else {
                svg.call(z.event);
            }
        }
        this.moveToBBox = moveToBBox;

        // smoothly pan the view to center on a coordinate
        function moveTo(coord, duration) {
            var bbox = getViewBox();
            var padded = {x: coord.x - bbox.width/2,
                          y: coord.y - bbox.height/2,
                          width: bbox.width,
                          height: bbox.height},
                z = setZoom(padded);
            if (duration) {
                svg.transition()
                    .duration(duration)
                    .ease("linear")
                    .call(z.event);
            } else {
                svg.call(z.event);
            }
        }
        this.moveTo = moveTo;
        
        var getViewBox = this.getViewBox = function () {

            // Need to take the original transform of the main element
            // into account. A bit fiddly, and may not be quite correct
            // particularly regarding scale... keep an eye on this!
            var origTranslate = originalTransform.translate,
                origScale =  originalTransform.scale,     
                translate = zoom.translate(), scale = zoom.scale(),
                oTransX = origTranslate[0] * origScale[0] * scale,
                oTransY = origTranslate[1] * origScale[1] * scale;
            
            return {
                // x: -(translate[0] + oTransX) / scale,
                // y: -(translate[1] + oTransY) / scale,
                x: -translate[0] / scale,
                y: -translate[1] / scale,                
                width: elWidth / scale, height: elHeight / scale
            };
        };

        window.addEventListener("keydown", function (ev) {

            var bbox = getViewBox()
            console.log("keyCode " + ev.keyCode);

            switch(ev.keyCode) {

            // case 32:  // space
            //     moveToBBox(bbox)
            //     break;                

            case 37:  // left arrow key
                moveToBBox({
                    x: bbox.x - bbox.width * .25, y: bbox.y,
                    width: bbox.width, height: bbox.height
                });
                break;
            case 39:  // right arrow key
                moveToBBox({
                    x: bbox.x + bbox.width * .25, y: bbox.y,
                    width: bbox.width, height: bbox.height
                });
                break;
                
            case 38:  // up arrow key
                moveToBBox({
                    x: bbox.x, y: bbox.y - bbox.height * .25,
                    width: bbox.width, height: bbox.height
                });
                break;                
            case 40:  // down arrow key
                moveToBBox({
                    x: bbox.x, y: bbox.y + bbox.height * .25,
                    width: bbox.width, height: bbox.height
                });
                break;

            case 187:  // plus
                moveToBBox({
                    x: bbox.x + bbox.width/6,
                    y: bbox.y + bbox.height/6,
                    width: bbox.width/1.5, height: bbox.height/1.5
                })
                break;
            case 189:  // minus
                moveToBBox({
                    x: bbox.x - bbox.width/4,
                    y: bbox.y - bbox.height/4,
                    width: bbox.width * 1.5, height: bbox.height * 1.5
                })
                break;
            }
        });
        
        this.addCallback = function (cb) {
            changeCallbacks.push(cb);
            // send out a first event immediately
            setTimeout(function () {cb(getViewBox());});
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

        // return whether a given element is currently in view
        this.isInView = function (bbox) {
            var vbox = getViewBox();
            var width = bbox.width || 0, height = bbox.height || 0;
            var result = (bbox.x > vbox.x - width  &&
                          bbox.y > vbox.y - height &&
                          bbox.x < vbox.x + vbox.width &&
                          bbox.y < vbox.y + vbox.height);
            return result;
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
                .scaleExtent([scale0, maxZoom*scale0]);
            zoom.event(svg)
        }
        window.addEventListener("resize", updateSize);

    }

    return View;

})();
