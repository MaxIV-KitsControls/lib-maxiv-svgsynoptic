/*
 This creates the layer selector togglers that allow individual layers
 to be turned on/off
 */

QuickLinks = (function () {

    function _QuickLinks (container, svg, formatter) {
        var sections = svg.selectAll("#background .level0 .section")
            .data().map(function (d) {return d.section});

        sections.sort();
       
        var node = d3.select("#view")
            .append("div")
            .classed("quicklinks", true);
        
        sections.forEach(function (name) {
            node.append("div")
                .text(formatter(name))
                .classed("quicklink", true)
                .classed(name, true)
                .on("click", function () {runCallback("click", name)});
        });

        function runCallback(event, section) {
            if (event in callbacks) {
                callbacks[event](section);
            }
        }
        
        var callbacks = {};

        this.addCallback = function (event, cb) {
            callbacks[event] = cb;
        };
        
    }
    // return _LayerTogglers;
    return _QuickLinks;

})();
