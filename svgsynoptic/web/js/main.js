var synoptic;

window.addEventListener("load", function () {

    /* Note: "Backend" is our connection to the outside; it
       may be a Qt widget or an ajax bridge; from here it all
       works the same as the API should be identical. */
    
    function main (svg) {

        var container = document.getElementById("view");
        synoptic = new Synoptic(container, svg);

        // Mouse interaction
        synoptic.addEventCallback(
            "click", function (data) {
                if (R.has("section", data))
                    Backend.left_click("section", data.section);
                if (R.has("model", data))
                    Backend.left_click("model", data.model);
            });
        synoptic.addEventCallback(
            "contextmenu", function (data) {
                if (R.has("model", data))
                    Backend.right_click("model", data.model);
            });

        synoptic.addEventCallback(
            "tooltip", function (models) {
                Backend.subscribe_tooltip(models && models.join(","));
            });
        
        // Event subscription updates
        synoptic.addEventCallback("subscribe", subscribe);

        Backend.setup(); 

    }

    // send the list of visible things to the backend whenever
    // it changes.
    var oldSubs = "";
    function subscribe(subs) {
        var newSubs = R.pluck("model", subs);
        console.log("subscribe " + newSubs);
        newSubs.sort();
        newSubs = newSubs.join(",");
        if (newSubs != oldSubs) {
            Backend.subscribe(newSubs); 
            oldSubs = newSubs;
        }
    }

    // Load the actual SVG into the page
    function load (svg, section) {
        console.log("load " + svg);
        d3.xml(svg, "image/svg+xml", function(xml) {
            var svg = d3.select(document.importNode(xml.documentElement, true));
            d3.ns.prefix.inkscape = "http://www.inkscape.org/namespaces/inkscape";
            sanitizeSVG(svg);
            activateSVG(svg);
            main(svg);
        });
    }
    window.load = load;

    function sanitizeSVG (svg) {

        // Setup all the layers that should be user selectble
        var layers = svg.selectAll("svg > g > g")
                .filter(function () {
                    return d3.select(this).attr("inkscape:groupmode") == "layer";})
                .attr("id", function () {
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
                var name = d3.select(this).attr("inkscape:label");
                return !R.contains(name, ["background", "symbols"]);})
            .classed("togglable", true);

        // activate the zoom levels (also in need of improvement)
        var zoomlevels = svg.selectAll("svg > g > g > g");
        zoomlevels
            .each(function () {
                var node = d3.select(this),
                    name = d3.select(this).attr("inkscape:label"),
                    match = /zoom(\d)/.exec(name);
                if (match) {
                    var level = parseInt(match[1]);
                    console.log("zoom level", name, level);
                    node.classed("zoom", true);
                    node.classed("level"+level, true);
                }
            });

        if (svg.select("g").attr("transform"))
            console.log("*Warning* there is a transform on the 'main' layer/group in the SVG. " +
                        "This is likely to mess up positioning of some things.");


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
        // definitions like e.g. "device=x/y/z". For those found we set
        // the class and data of the parent element accordingly.
        // This makes it convenient to use D3.js to iterate over things.
        //var pattern = /^(device|attribute|section|alarm)=(.*)/;
        var pattern = /^(.*)=(.*)/;

        //svg.call(tooltip);

        svg.selectAll("desc")
            .each(function () {
                var lines = this.textContent.split("\n"),
                    data = {}, classes = {};
                lines.forEach(function (line) {
                    var match = pattern.exec(line);
                    if (match) {
                        var kind = match[1].trim(),  
                            name = match[2].trim();
                        data[kind] = name.split(",");
                        console.log(kind + " " + name + " " + data[kind])
                        classes[kind] = true;

                        // if (kind == "device" && !data.attribute) {
                        //     // For devices, we assume that the "status" attribute
                        //     // is interesting. This saves a lot of typing.
                        //     data.attribute = name + "/State";
                        // }
                    }
                }, this);
                console.log(classes);
                d3.select(this.parentNode)
                    .classed(classes)
                    .datum(data);

            });;

    }

    d3.selection.prototype.size = function() {
        var n = 0;
        this.each(function() { ++n; });
        return n;
    };
    // load("images/maxiv.svg");

    //main(synoptify(draw(ring3)));

});
