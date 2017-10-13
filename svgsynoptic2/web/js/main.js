var synoptic;

window.addEventListener("load", function () {

    /* Note: the "backend" is our connection to the outside; it
       may be a Qt widget or a HTTP bridge; from here it all
       works the same, the API should be identical. */
    
    function main (container, svg, config) {

        // var container = document.getElementById("view");
        config = config || {};
        
        console.log("config "  + JSON.stringify(config));
        synoptic = new Synoptic(container, svg, config);

        console.log("synoptic " + synoptic)

        // if the user supplies a backend, we'll use it
        backend = config.backend || new Backend();
        console.log("backend", backend);
        
        // Mouse interaction
        synoptic.addEventCallback(
            "click", function (data) {
                console.log("click ", data);
                if (data && data.hasOwnProperty("section"))
                    backend.leftClick("section", data.section);
                if (data && data.hasOwnProperty("model"))
                    backend.leftClick("model", data.model);
            });
        synoptic.addEventCallback(
            "contextmenu", function (data) {
                if (R.has("model", data))
                    backend.rightClick("model", data.model);
            });

        // synoptic.addEventCallback(
        //     "hover", function (data) {
        //         if (!data) {
        //             // mouse has left something
        //             Backend.hover("", "");
        //         } else {
        //             // mouse has entered something
        //             var models = data.model, //&& data.model.join("\n") || "",
        //                 section = data.section || "";
        //             Backend.hover(section, models);
        //         }
        //     });
        
        // Event subscription updates

        // send the list of visible things to the backend whenever
        // it changes.
        function subscribe(newSubs) {
            newSubs.sort();
            backend.subscribe(newSubs); 
        }
        synoptic.addEventCallback("subscribe", subscribe);
        // Backend.setup(); 

    }

    window.runSynoptic = main;


    // Load the actual SVG into the page
    function load (svg, element, config) {
        console.log("load " + svg);
        element = element || window;
        d3.xml(svg, "image/svg+xml", function(xml) {
            var svg = d3.select(document.importNode(xml.documentElement, true));
            d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";
            // Some preprocessing of the SVG may be needed
            sanitizeSVG(svg);

            // Get information from the structure of the file
            activateSVG(svg);
            
            main(element, svg, config);
        });
    }
    window.loadSVG = load;

    function loadString (svgString) {
        console.log("loadString")
        var tmp = document.createElement("div");
        tmp.innerHTML = svgString;
        d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";
        svg = d3.select(tmp).select("svg");
        sanitizeSVG(svg);
        activateSVG(svg);
        main(svg);
    }
    window.loadSVGString = loadString;
    
    function sanitizeSVG (svg) {

        // Setup all the layers that should be user selectble
        var layers = svg.selectAll("svg > g > g")
            .filter(function () {
                // console.log("sanitix " + d3.select(this).attr("inkscape:groupmode"));
                return d3.select(this).attr("inkscape:groupmode") == "layer";})
            .attr("data-name", function () {
                //console.log("sanitix " + d3.select(this).attr("inkscape:label"));
                return d3.select(this).attr("inkscape:label");})  // ugh
            .attr("display", null)
            .style("display", null);
        
        // Set which layers are selectable
        // TODO: find a better way to do this; it relies on inkscape
        // specific tags and hardcoding layer names is not nice either!
        layers
            .classed("layer", true);
        layers
            .filter(function () {
                // we don't want hidden or background layers to be
                // togglable
                var name = d3.select(this).attr("inkscape:label");
                return !this.classList.contains("background") &&
                    !this.classList.contains("hidden") &&
                    !R.contains(name, ["background", "symbols"]);
            })
            .classed("togglable", true);

        // activate the zoom levels (also in need of improvement)
        var zoomlevels = svg.selectAll("svg > g > g > g");
        zoomlevels
            .each(function () {
                var node = d3.select(this),
                    name = node.attr("inkscape:label"),
                    match = /zoom(\d)/.exec(name);
                if (match) {
                    var level = parseInt(match[1]);
                    console.log("zoom level", name, level);
                    node.classed("zoom", true);
                    node.classed("level"+level, true);
                    node.style("display", null);
                }
            });


        
        // // Note: this should now be fixed... remove
        // if (svg.select("g").attr("transform")) {
        //     console.log("********************************************************")
        //     console.log("*Warning* there is a transform on the 'main' layer/group in the SVG. " +
        //                 "This is likely to mess up positioning of some things.");
        //     console.log("********************************************************")
        // }


        // Remove inline styles from symbols, to make sure they will
        // take our class styles.
        // svg.selectAll("symbol>*")
        // svg.selectAll("#symbols > *")
        //     .style("fill", null)
        //     .attr("fill", null)
        //     .style("display", null)
        //     .style("visibility", null);

        // Find all <use> nodes and replace them with their reference.
        // This ugly hack is a workaround for qtwebkit being slow to
        // render <use> nodes in some cases (e.g. rotated
        // transforms). Hopefully this can be removed in the future.

        // svg.selectAll("use")
        //     .each(function () {util.reifyUse(svg, this);});

        // Here we might also do some checking on the supplied SVG
        // file so that it has the right format etc, and report
        // problems back.

    }

    function activateSVG (svg) {
        // go through the svg and find all <desc> elements containing
        // definitions like e.g. "model=x/y/z". For those found we set
        // the class and data of the parent element accordingly.
        // This makes it convenient to use D3.js to iterate over things.
        var pattern = /^(model|section|alarm)=(.*)/;
        // TODO: Allow arbitary data on nodes? How could that be used?

        svg.selectAll("desc")
            .each(function () {
                var lines = this.textContent.split("\n"),
                    data = {}, classes = {};
                lines.forEach(function (line) {
                    var match = pattern.exec(line);
                    if (match) {
                        var kind = match[1].trim().toLowerCase(),  
                            name = match[2].trim();
                        data[kind] = name;
                    }
                }, this);

                // Now store the data as "data" attributes on the node.
                // This way javascript and CSS can access it easily.
                var parent = this.parentNode;
                d3.select(parent).classed(data);
                Object.keys(data).forEach(function (kind) {
                    parent.setAttribute("data-" + kind, data[kind]);
                    // we'll also add a "normalized" version of the
                    // attribute, to use for CSS matching rules. These
                    // are always case sensitive.
                    // TODO: Should this be further normalized? 
                    parent.setAttribute("data-" + kind + "-normalized", data[kind].toLowerCase());
                });

            });;
    }

    d3.selection.prototype.size = function() {
        var n = 0;
        this.each(function() { ++n; });
        return n;
    };
    // load("images/maxiv.svg");

    window.loadElement = function (svg) {
        synoptify(svg);
    }
    
    // runSynoptic(draw(ring3));

});
