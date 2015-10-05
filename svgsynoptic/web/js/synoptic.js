Synoptic = (function () {

    // This represents the whole "synoptic" widget and all interactions
    function Synoptic (container, svg, config) {

        config = config || {};

        var svg_copy = d3.select(svg.node().cloneNode(true));
                
        // the View takes care of the basic navigation; zooming,
        // panning etc, and switching between detail levels.
        var view = new View(container, svg, config.view);

        this.container = container;
        
        // whenever the user zooms or pans the view, we need to update the
        // listeners etc. But since this is a pretty expensive and slow
        // operation, we'll only do it once the user has stopped moving
        // around for a bit.
        view.addCallback(
            _.debounce(updateVisibility, 500, {leading: false}));

        
        /* optional plugins */
        
        if (window.LayerTogglers) {
            var layers = new LayerTogglers(container, svg, config.layers);
            layers.addCallback(function () {updateVisibility();});
        }
            
        if (window.Thumbnail)
            var thumbnail = new Thumbnail(container, view, svg_copy,
                                          config.thumbnail);
        
        if (window.Tooltip) {
            var tooltip = new Tooltip(container);
            view.addCallback(_.debounce(tooltip.close, 500, {leading: true}));
        }

        
        /********** Utils **********/

        var selectNodes = function (type, name) {
            // return a d3 selection containing all elements of that has a "type" (e.g. model) called "name"
            return svg.selectAll("." + type)
                .filter(function (d) {return (d[type] == name) ||
                                      (d[type].indexOf(name) != -1);});
        }

        /********** Input events **********/

        // this is where we keep all registered callbacks for things like mouseclicks
        var listeners = {
            "click": [],
            "contextmenu": [],
            "subscribe": [],
            "unsubscribe": [],
            "hover": []
        };

        // run any registered callbacks for a given event and item type
        function fireEventCallbacks(eventType, data) {
            console.log("fireEventCallbacks " + eventType);
            if (listeners[eventType])
                listeners[eventType].forEach(function (cb) {cb(data);});
        }

        function getTypeFromData(el) {
            if (el.section)
                return "section";
            if (el.model)
                return "model";
        }

        // TODO: refactor, this probably belongs in the View...
        function setupMouse () {

            // Note: it would be nicer to put these callbacks on the
            // SVG element instead of on each and every clickable
            // element. But for some reason this does not work in
            // qtwebkit, the d3.event.target does not get set to the
            // correct element.  It works in FF and Chrome so it's
            // likely to be a bug in older webkit versions.

            // leftclick
            svg
                .selectAll(".section, .model")
                .on("click", function (d) {
                    if (d3.event.defaultPrevented) return;
                    // Only makes sense to click items with data
                    if (d) fireEventCallbacks("click", d);
                })
            // rightclick
                .on("contextmenu", function (d) {
                    if (d3.event.defaultPrevented) return false;
                    if (d) fireEventCallbacks("contextmenu", d);
                    return false;
                })
            // hover            
                .on("mouseover", function (d) {
                    // vbox = view.getViewBox();
                    // var visible = isInView(getBBox("model", d.model[0]), vbox);
                    // console.log("visible " + d.model[0] + " " +  visible)
                    if (d) fireEventCallbacks("hover", d);
                })
                .on("mouseout", function (d) {
                    if (d) fireEventCallbacks("hover", null);
                })

        }

        setupMouse();

        function selectModel (model) {
            var node = selectNodes("model", model).node(),
                bbox = getBBox("model", model);

            console.log("selectModel " + model + " " +
                        bbox.x + " " + bbox.y + " " +
                        bbox.width + " " + bbox.height)
            d3.select(node.parentNode)
                .insert("svg:ellipse", ":first-child")
                .attr("cx", bbox.x + bbox.width/2)
                .attr("cy", bbox.y + bbox.height/2)
            // .attr("r", Math.max(bbox.width, bbox.height) / 1.5)
                .attr("rx", bbox.width)
                .attr("ry", bbox.height)
                .classed("selection", true);
        }

        /********** Tango events **********/

        function setClasses(type, name, classes) {
            selectNodes(type, name)
                .classed(classes)
                .classed("updated", true);
        }        

        /********** Visibility **********/

        var _bboxes = {device: {}, attribute: {}, section: {}};

        // return whether a given element is currently in view
        function isInView(bbox, vbox) {
            // console.log("isInView " + bbox + " " + vbox);
            if (!bbox)
                return false;
            var result = (bbox.x > vbox.x - bbox.width &&
                          bbox.y > vbox.y - bbox.height &&
                          bbox.x < vbox.x + vbox.width &&
                          bbox.y < vbox.y + vbox.height);
            return result;
        }

        // precalculate device bounding boxes
        // Since the element can be a <use> element we can't trust
        // the getBBox result but have to do something heavier...
        // devNodes.each(function (d) {
        //     try {
        //         _bboxes.device[d.name] = util.transformedBoundingBox(this);
        //     } catch (e) {
        //         // This probably means that the element is not displayed.
        //     }
        // });
        // attrNodes.each(function (d) {
        //     try {
        //         _bboxes.attribute[d.name] = util.transformedBoundingBox(this);
        //     } catch (e) {console.log("no bbox for attribute", d.name);}
        // });

        // secNodes.each(function (d) {
        //     try {
        //         _bboxes.section[d.name] = util.transformedBoundingBox(this);
        //     } catch (e) {
        //         console.log("no bbox for section", d.name);
        //     }
        // });


        function _getBBox (type, name) {
            try {     
                var node = selectNodes(type, name).node();
                var bbox = util.transformedBoundingBox(node);
                // var bbox = node.getBoundingClientRect();
                return bbox;
            } catch (e) {
                console.log(type + " " + name + " " + e);
                // This probably means that the element is not displayed.
                // return {x: node.getAttribute("x"),
                //         y: node.getAttribute("y"),
                //         width: 0, height: 0};
            }
        }
        // this gets used a lot, so we memoize it
        var getBBox = _.memoize(_getBBox, function (a, b) {return a + b;});

        // return a selection containing the devices in the currently
        // shown layers and zoom levels.
        function selectShownThings() {
            return svg.selectAll(
                "g.layer:not(.hidden) > .model, " +
                "g.layer:not(.hidden) > g.zoom:not(.hidden) > .model"
            );
        }

        // Hmm... this does not quite work
        function selectHiddenThings() {
            return svg.selectAll(
                "g.layer.hidden .model, g.zoom.hidden > .model"
            );
        }

        function fireSubscribeCallbacks(sel) {
            listeners.subscribe.forEach(
                function (cb) {
                    try {
                        cb(sel.data());
                    } catch (e) {
                        console.log("Error subscribing to", sel.data(), e);
                    }
                });
            subEvent = null;
        }

        // Find all devices that can be seen and activate them
        function updateVisibility (vbox) {
            // TODO: for some reason we don't unsubscribe to things when
            // zooming *out* to a higher level.
            vbox = vbox || view.getViewBox();
            var sel = selectShownThings();

            console.log("updateVisibility " + vbox.x + ", " + vbox.y + ", " + vbox.width + ", " + vbox.height);

            sel  // hide things that are out of view
                .filter(function (d) {
                    var visible = isInView(getBBox("model", d.model[0]), vbox);
                    // console.log("model " + d.model[0] + " " + visible);
                    return !visible
                })
                .classed("hidden", true)
                .classed("updated", false);

            sel  // show things that are in view
                .filter(function (d) {
                    return isInView(getBBox("model", d.model[0]), vbox);
                })
                .classed("hidden", false)  // then activate visible ones
                .call(fireSubscribeCallbacks);

            // TODO: pretty inefficient to run isInView twice for every
            // item. There must be a better way!
        }

        function zoomTo (type, name) {
            var sel = selectNodes(type, name);
            var node = sel[0][0];
            var bbox = util.transformedBoundingBox(node);
            console.log(node + " bbox " + bbox.x + " " + bbox.y + " " +
                        bbox.width + " " + bbox.height);
            view.moveToBBox(bbox, 200, 0.25);
        };

        /********** API **********/

        this.addEventCallback = function (eventType, callback) {
            listeners[eventType].push(callback);
            
            if (eventType == "subscribe")
                updateVisibility;
        };

        // TODO: removeEventCallback()
        
        this.zoomTo = zoomTo;
        
        this.select = function (type, name) {
            switch (type) {
            case "model":
                selectModel(name);
                break;
            }
        };

        this.unselectAll = function () {
            svg.selectAll(".selection").remove();
        };

        this.setClasses = function (type, name, classes) {
            // console.log("setClasses " + name + " " + Object.keys(classes).filter(function (m) {return classes[m]}).join(", "));
            setClasses(type, name, classes);
        };

        this.setText = function (type, name, html) {
            selectNodes(type, name).text(html);
        }

        this.showTooltip = function () {
            tooltip.open()
        }

        this.hideTooltip = function () {
            tooltip.close();
        }
        
        this.setTooltipHTML = function (html) {
            tooltip.setHTML(html);
        }
        
        // // preheat the getBBox cache (may take a few seconds)
        // svg.selectAll(".device, .attribute, .section")
        //     .filter(function (d) {
        //         if (d) getBBox(d.type, d.name);
        //     })

    }

    return Synoptic;

})();
