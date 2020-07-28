"use strict";

var util = {};


(function () {

    // take a "use" element and replace it with what it refers to
    // Note: This is a hack!
    util.reifyUse = function (svg, use) {
        var xlink = use.getAttribute("xlink:href");
        if (xlink) {
            var transform = use.getAttribute("transform");
            var ref = svg.select(xlink);
            if (ref && ref.node() && ref.node().childNodes) {
                var orig = ref.node().childNodes[1],  // TODO: handle multiple elements
                    copy = orig.cloneNode(true),
                    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
                group.setAttribute("transform", transform);
                group.appendChild(copy);
                var desc = use.querySelector("desc");
                if (desc) {
                    group.appendChild(desc.cloneNode(true));
                }
                use.parentNode.insertBefore(group, use);
                use.parentNode.removeChild(use);
            }
        }
    };

    util.rotationFromTransformMatrix = function (tr) {
        var match = /matrix\((.*\))/.exec(tr);
        if (match) {
            var mat = match[1].split(",").map(parseFloat);
            return Math.atan2(mat[3], mat[4]);
        }
        return 0;
    };

    // Calculate the bounding box of an element with respect to its parent element
    util.transformedBoundingBox = function (el){
        var bb  = el.getBBox(),
            svg = el.ownerSVGElement,
            m   = el.getScreenCTM().inverse().multiply(el.parentNode.getScreenCTM());

        // Create an array of all four points for the original bounding box
        var pts = [
            svg.createSVGPoint(), svg.createSVGPoint(),
            svg.createSVGPoint(), svg.createSVGPoint()
        ];
        pts[0].x=bb.x;          pts[0].y=bb.y;
        pts[1].x=bb.x+bb.width; pts[1].y=bb.y;
        pts[2].x=bb.x+bb.width; pts[2].y=bb.y+bb.height;
        pts[3].x=bb.x;          pts[3].y=bb.y+bb.height;

        // Transform each into the space of the parent,
        // and calculate the min/max points from that.
        var xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
        pts.forEach(function(pt){
            pt = pt.matrixTransform(m);
            xMin = Math.min(xMin,pt.x);
            xMax = Math.max(xMax,pt.x);
            yMin = Math.min(yMin,pt.y);
            yMax = Math.max(yMax,pt.y);
        });

        // Update the bounding box with the new values
        bb.x = xMin; bb.width  = xMax-xMin;
        bb.y = yMin; bb.height = yMax-yMin;
        return bb;
    };

    util.bboxOverlap = function (bb1, bb2) {
        var left1 = bb1.x, right1 = bb1.x + bb1.width, bottom1 = bb1.y, top1 = bb1.y + bb1.height,
            left2 = bb2.x, right2 = bb2.x + bb2.width, bottom2 = bb2.y, top2 = bb2.y + bb2.height;
        if (right1 <= left2 || left1 >= right2 || bottom1 >= top2 || top1 <= bottom2)
            return null;
        var bbox = {
            x: Math.max(left1, left2),
            y: Math.min(top1, top2)
        };
        bbox.width = Math.min(right1, right2) - bbox.x;
        bbox.height = bbox.y - Math.max(bottom1, bottom2);
        return bbox;
    };

    // find the coordinates of the center of a bounding box
    util.getCenter = function (bbox) {
        if (bbox)
            return new Vector(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2);
    };

    // Find the bounding box of an element
    util.getRect = function (type, id) {
        // Note: does not care a bout the type for now
        var el = document.getElementById(id);
        if (el) {
            var bbox = util.transformedBoundingBox(el);
            return{x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height};
        } else return null;
    };

    // set/unset a given class on an SVG element 
    util.setClass = function (node, className, on) {
        var classes = node.getAttribute("class");
        var classList = (classes || "").split(" ");
        var index = classList.indexOf(className);
        if (on && index === -1) {
            node.setAttribute("class", classes + " " + className);
        } else if (!on && index !== -1) {
            classList.splice(index, 1);
            node.setAttribute("class", classList.join(" "));
        }
    };

    // Run a function on each element in an array-like (e.g. a NodeList)
    // Useful for things that don't have the usual array "forEach" method.
    util.forEach = function (someList, fun) {
        for(var i=0; i<someList.length; i++) {
            fun(someList[i]);
        }
    };
 
})();
