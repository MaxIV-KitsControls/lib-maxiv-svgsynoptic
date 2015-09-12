Synoptic = (function () {

    // This represents the whole "synoptic" widget and all interactions
    function Synoptic (container, svg) {

        // the View takes care of the basic navigation; zooming,
        // panning etc, and switching between detail levels.
        var view = new View(container, svg, [1, 10, 100]);
        
        // whenever the user zooms or pans the view, we need to update the
        // listeners etc. But since this is a pretty expensive and slow
        // operation, we'll only do it once the user has stopped moving
        // around for a bit.
        view.addCallback(
            _.debounce(updateVisibility, 500, {leading: false}));

        var layers = new LayerTogglers(container, svg);
        layers.addCallback(function () {updateVisibility();});
        
        // var quicklinks = new QuickLinks(container, svg, function (section) {return section.split("-")[1];});
        // //quicklinks.addCallback("click", functionconsole.log()); 
        // quicklinks.addCallback("click", zoomTo.bind(this, "section"));       

        
        /********** Utils **********/

        var selectNodes = function (type, name) {
            return svg.selectAll(":not(text)." + type)
                .filter(function (d) {return (d[type] == name) ||
                                      (d[type].indexOf(name) != -1);});
        }

        function getNodeId (data) {
            return data.model + "+" + data.section;
        }

        /********** Input events **********/

        // this is where we keep all registered callbacks for things like mouseclicks
        var listeners = {
            "click": [],
            "contextmenu": [],
            "subscribe": [],
            "unsubscribe": [],
            "tooltip": []
        };

        // run any registered callbacks for a given event and item type
        function fireEventCallbacks(eventType, data) {
            console.log("fireEventCallbacks " + eventType);
            listeners[eventType].forEach(function (cb) {cb(data);});
        }

        function getTypeFromData(el) {
            if (el.section)
                return "section";
            if (el.model)
                return "model";
        }

        function setupMouse () {

            // Note: it would be nicer to put these callbacks on the
            // SVG element instead of on each and every clickable
            // element. But for some reason this does not work in
            // qtwebkit, the d3.event.target does not get set to the
            // correct element.  It works in FF and Chrome so it's
            // likely to be a bug in older webkit versions.

            // leftclick
            svg.selectAll(".section, .model")
                .on("click", function (d) {
                    //selectDevice(d.name);
                    var type = getTypeFromData(d);
                    console.log("click " + type + " " + d[type]);
                    var bbox = getBBox(type, d[type]);
                    console.log("click bbox "+bbox.x+" "+bbox.y);
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
            // hover -> tooltip
                .on("mouseover", showTooltip)
                .on("mousemove", moveTooltip)
                .on("mouseout", closeTooltip);
        }

        var tooltip, tooltipUpdater;

        function updateTooltip(model) {
            fireEventCallbacks("tooltip", model);
        }

        function showTooltip(data) {
            if (this.getAttribute("id")) {
                if (tooltip)
                    tooltip.close();
                tooltip = new Tooltip(container, getNodeId(data), data);
                tooltip.update(data);
                tooltip.move();
                fireEventCallbacks("tooltip", data.model)
            }
        }

        function moveTooltip(data) {
            if (tooltip && getNodeId(data) == tooltip.id) {
                tooltip.move();
            }
        }

        function closeTooltip(data) {
            if (tooltip && getNodeId(data) == tooltip.id) {
                tooltip.close();
                delete tooltip;
                fireEventCallbacks("tooltip", []);
            }
        }

        setupMouse();

        function selectModel (model) {
            var node = selectNodes("model", model).node(),
                bbox = getBBox("model", model);

            console.log("selectModel " + model + " " + bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height)
            d3.select(node.parentNode)
                .insert("svg:circle", ":first-child")
                .attr("cx", bbox.x + bbox.width/2)
                .attr("cy", bbox.y + bbox.height/2)
                .attr("r", Math.max(bbox.width, bbox.height) / 1.5)
                .classed("selection", true);
        }

        /********** Tango events **********/

        function setState(type, name, state) {
            selectNodes(type, name)
                .classed(getStateClasses(state));
        }
        
        var states = ["UNKNOWN", "INIT", "RUNNING", "MOVING",
                      "ON", "OFF", "INSERT", "EXTRACT", "OPEN", "CLOSE",
                      "STANDBY", "ALARM", "FAULT", "DISABLE"];

        function getStateClasses(state) {
            var classes = {};
            states.forEach(function (s) {
                classes["state-" + s] = s == state;
            });
            return classes;
        };

        var no_state_classes = getStateClasses();

        // function handleAttributeEvent (event) {
        //     var classes;
        //     var sel = selectNodes("attribute", event.model);
        //     if (event.event_type == "value") {
        //         if (event.type == "DevState") {
        //             classes = getStateClasses(event.html);
        //             sel.classed(classes);
        //             var devicename = event.model.split("/").slice(0, -1).join("/");
        //             selectNodes("device", devicename)
        //                 .classed(classes);
        //         } else if (event.type == "DevBoolean") {
        //             var value = parseFloat(event.html) !== 0.0;
        //             classes = {"boolean-true": value, "boolean-false": !value};
        //             sel.classed(classes);
        //         } else {
        //             // TODO: printf?
        //             sel.text(event.html + (event.unit? " " + event.unit : ""));
        //         }
        //     }
        //     if (tooltip) {
        //         if (getNodeId(event) == tooltip.id) {
        //             tooltip.update(event);
        //         }
        //     }
        // };


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
            console.log("_getBBox " + type +","+ name);
            try {     
                var node = selectNodes(type, name).node();
                console.log("node " + node);
                var bbox = util.transformedBoundingBox(node);
                // var bbox = node.getBoundingClientRect();
                return bbox;
            } catch (e) {
                console.log(e)
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
                "g.layer:not(.hidden) > g.zoom:not(.hidden) > .model"
            );
        }

        // Hmm... this does not quite work
        function selectHiddenThings() {
            return svg.selectAll("g.layer.hidden .model, g.zoom.hidden > .model");
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

            sel  // hide things that are out of view
                .filter(function (d) {
                    return !isInView(getBBox("model", d.model[0]), vbox);
                })
                .classed("hidden", true)
                .classed(no_state_classes);  // remove state info

            sel  // show things that are in view
                .filter(function (d) {
                    return isInView(getBBox("model", d.model[0]), vbox);
                })
                .classed("hidden", false)  // then activate visible ones
                // if it's an attribute, subscribe to it
                //.filter(function (d) {return d && d.attribute;})
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
            svg.selectAll("circle.selection").remove();
        };


        // this.handleEvents = function (events) {
        //     //events = JSON.parse(events);
        //     events.forEach(handleAttributeEvent);
        // };

        // this.handleEvent = function (event) {
        //     // console.log("handleEvent " + event);
        //     handleAttributeEvent(JSON.parse(event));
        // }

        this.setState = setState;

        this.setTooltipHTML = function (model, html) {
            console.log("setToolTioHTMO " + model + " " + html);
            tooltip && tooltip.setHTML(model, html);
        }
        
        // // preheat the getBBox cache (may take a few seconds)
        // svg.selectAll(".device, .attribute, .section")
        //     .filter(function (d) {
        //         if (d) getBBox(d.type, d.name);
        //     })

    }

    return Synoptic;

})();
