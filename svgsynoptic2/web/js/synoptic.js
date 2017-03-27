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
        view.addCallback(_.debounce(updateVisibility, 500, {leading: false}));

        // // this is a debugging tool; uncomment it to be able to see the
        // // current part of the image that the synoptic considers as "visible"
        // var viewRect = svg.select("svg > g")
        //     .append("rect")
        //     .style("fill", "yellow")
        //     .style("stroke-width", "5%")
        //     .style("stroke", "red")
        //     .style("opacity", 0.3);
        // var viewRectText = svg.select("svg > g").append("text")
        //     .text("test")
        //     .style("font-size", "100")
        //     .attr("dy", 100);
        // view.addCallback(_.debounce(function (bbox) {
        //     viewRect.attr(bbox);
        //     viewRectText
        //         .attr("x", bbox.x)
        //         .attr("y", bbox.y)
        //         .text(Math.round(bbox.width) + ", " + Math.round(bbox.height))
        // }, 500));
        
        /********** optional plugins **********/
        // The plugins are only added if they are loaded from the HTML file.
        // TODO: Figure out a more flexible way to load these, to make
        // it possible to add custom plugins.
        
        if (window.LayerTogglers) {
            var layers = new LayerTogglers(container, svg, config.layers);
            layers.addCallback(function () {updateVisibility();});
        }
            
        if (window.Thumbnail)
            var thumbnail = new Thumbnail(container, view, svg_copy,
                                          config.thumbnail);
        
        if (window.Tooltip) {
            var tooltip = new Tooltip(container, view);
        }

        // if (window.Notes) {
        //     var notes = new Notes(container, view, []);
        // }
        
        /********** Utils **********/

        var selectNodes = function (type, name) {
            // return a d3 selection containing all elements of that
            // has a "type" (e.g. model) called "name"
            // Note that we can't make any assumptions about the letter casing
            // of the model names, as there can be differences between what's
            // used in the database and in the SVG. So we must normalize to compare.
            return svg.selectAll("." + type)
                .filter(function (d) {
                    return (d[type] == name.toLowerCase()) ||
                        ((d[type] || []).map(function (n) {
                            return n.toLowerCase();
                        }).indexOf(name.toLowerCase()) != -1);});
        };

        /********** Input events **********/
        // this is where we keep all registered callbacks for things
        // like mouseclicks
        
        var listeners = {
            "click": [],
            "contextmenu": [],
            "subscribe": [],
            "unsubscribe": [],
            "hover": []
        };

        // run any registered callbacks for a given event and item type
        function fireEventCallbacks(eventType, data) {
            // console.log("fireEventCallbacks " + eventType);
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
            svg.selectAll(".section, .model")
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
                    if (d) fireEventCallbacks("hover", d);
                })
                .on("mouseout", function (d) {
                    if (d) fireEventCallbacks("hover", null);
                })
        }

        setupMouse();

        // mark a model (could be several items) as "selected"
        function selectModel (model) {
            selectNodes("model", model)
                .each(function (d) {
                    var bbox = d.bbox;
                    console.log("selectModel " + model + " " +
                                bbox.x + " " + bbox.y + " " +
                                bbox.width + " " + bbox.height)
                    d3.select(this.parentNode)
                        .insert("svg:ellipse", ":first-child")
                        .attr("cx", bbox.x + bbox.width/2)
                        .attr("cy", bbox.y + bbox.height/2)
                        .attr("rx", bbox.width)
                        .attr("ry", bbox.height)
                        .classed("selection", true);
                })
        }

        /********** Tango events **********/

        // update CSS classes on selected nodes
        function setClasses(type, name, classes) {
            selectNodes(type, name)
                .classed(classes);
        }        

        // update the dataset attribute on selected nodes
        function setData(type, name, data) {
            selectNodes(type, name)
                .each(function () {_.extend(this.dataset, data);});
        }
        
        /********** Visibility **********/

        var _bboxes = {device: {}, attribute: {}, section: {}};

        // return whether a given element is currently in view
        function isInView(bboxes, vbox) {
            // console.log("isInView " + bbox + " " + vbox);
            if (!bboxes)
                return false;
            return bboxes.some(function (bbox) {
                return (bbox.x > vbox.x - bbox.width &&
                        bbox.y > vbox.y - bbox.height &&
                        bbox.x < vbox.x + vbox.width &&
                        bbox.y < vbox.y + vbox.height);
            });
        }

        // calculate the "bounding box" (smallest encompassing rectangle) for
        // all nodes with a given type and name. This is used for checking if
        // the element is in view or not.
        function _getBBox (type, name) {
            try {
                var bboxes = [];
                selectNodes(type, name)
                    .each(function (d) {
                        var bbox;
                        bbox = util.transformedBoundingBox(this);
                        // we'll also store the bbox in the node's data for easy
                        // access. 
                        d.bbox = bbox;
                        bboxes.push(bbox)
                    })
                return bboxes;
            } catch (e) {
                // console.log(type + " " + name + " " + e);
                // This probably means that the element is not displayed.
                return {x: node.getAttribute("x"),
                        y: node.getAttribute("y"),
                        width: 0, height: 0};
            }
        }
        // getBBox() gets used a lot (and the bboxes should never change),
        // so we memoize it
        var getBBox = _.memoize(_getBBox, function (a, b) {
            return (a + ":" + b).toLowerCase();
        });

        // return a selection containing the devices in the currently
        // shown layers and zoom levels.
        function selectShownThings() {
            return svg.selectAll(
                "g.layer:not(.hidden) > .model, " +
                "g.layer:not(.hidden) > g:not(.zoom) .model, " +
                "g.layer:not(.hidden) > g.zoom:not(.hidden) .model"
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
        }

        // Find all devices that can be seen and activate them
        function updateVisibility (vbox) {

            vbox = vbox || view.getViewBox();
            var sel = selectShownThings();

            sel  // hide things that are out of view
                .filter(function (d) {
                    var visible = isInView(getBBox("model", d.model[0]), vbox);
                    return !visible
                })
                .classed("hidden", true)

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
        
        this.select = function (type, names) {
            switch (type) {
            case "model":
                names.forEach(selectModel);
                break;
            }
        };

        this.unselectAll = function () {
            svg.selectAll(".selection").remove();
        };

        this.setClasses = function (type, name, classes) {
            setClasses(type, name, classes);
        };

        this.setData = function (type, name, data) {
            setData(type, name, data);
        };
        
        this.setText = function (type, name, html) {
            selectNodes(type, name).text(html);
        }

        this.showTooltip = function () {
            if (tooltip)
                tooltip.open()
        }

        this.hideTooltip = function () {
            if (tooltip)            
                tooltip.close();
        }
        
        this.setTooltipHTML = function (html) {
            if (tooltip)            
                tooltip.setHTML(html);
        }

        this.setNotes = function (data) {
            console.log("setNotes " +  data);
            if (notes) {
                var notedata = JSON.parse(data);
                notes.setData(notedata);
            }
        }

        this.newNote = function (data) {
            if (notes) {
                var notedata = JSON.parse(data);
                notes.addNote(notedata);
            }
        }
        
        this.getModels = function () {
            var models = [];
            svg.selectAll(".model").each(function (d) {models.append(d.model)});
            return models;
        }
       
    }

    return Synoptic;

})();
