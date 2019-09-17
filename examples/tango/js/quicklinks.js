/*
  Creates a simple list of "quick links" to zoom the view to some
  given sections.

  Expects the container element for the synoptic, the svg itself, and
  a list of section names. Adds one clickable element per section
  along the top of the container.
 */

QuickLinks = (function () {

    function _QuickLinks (container, svg, sections) {

        var node = d3.select("#view")
            .append("div")
            .classed("quicklinks", true);
        
        sections.forEach(function (desc) {
            console.log(desc);
            if (Array.isArray(desc)) {
                var sec = desc[0], title = desc[1];
            } else {
                var sec = title = desc;
            }
            
            node.append("div")
                .text(title)            
                .classed("quicklink", true)
                .classed(sec, true)
                .on("click", function () {runCallback("click", sec)});
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

    return _QuickLinks;

})();
