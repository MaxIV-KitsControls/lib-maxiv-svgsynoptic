# SVG synoptic #


## Important ##

There has been some refactoring of this library since version 2.1. The
changes are mostly under the hood, but there is one change that needs
to be done to existing synoptics to work with later versions: a
"backend" must be loaded. At the moment, only the Qt backend is
usable, which works exactly like it used to, it's just separated out
and needs this line to be loaded from the HTML, e.g.:

    <script src="js/qt_backend.js"></script>

See the examples if this is unclear.


## Installation ##

Like any python package. E.g. to install in your home directory:

    $ python setup.py install --user


## Examples ##

    $ cd examples
    $ python -m simple


## Introduction ##

The SVG synoptic enables an intuitive way of interaction with a control system, by displaying a graphical representation (e.g. a drawing) of the physical and/or logical structure, and allowing various information and interactions to be tied in to this representation. The user can interact by panning/zooming (if the drawing is complex enough to require this) and "hovering"/clicking elements to bring up informations or launch more specific panels.

The library is developed with the TANGO control system in mind, and has a Qt widget implementation based on Taurus. It should however be possible to adapt it to other systems as well.

A SVG synoptic consists mainly of an SVG format file, that can be produced in any way. There are various software packages that can be used (inkscape is a good FOSS alternative) that can be used by non-programmers, but since SVG is an open, XML based format, it is possible to generate the files programmatically. 

By annotating elements in the SVG file, they can be connected to control system items, displaying e.g. the current on/off state, an alarm, or a numerical value. 

The SVG synoptic can be run as a standalone application or embedded in a Qt application. There is also work underway to make it possible to run as a "web application".


## Usage ##

To make a simple synoptic application, all you need to do is copy the structure of one of the demo applications, create a SVG file of the correct structure, and modify "index.html" to suit your needs. 

### The SVG file ###

This is really the most important part of any synoptic application. It can in principle contain anything that is supported by SVG (caveat: the application currently uses the Qt4 webview widget to display the SVG, which is based on a slightly older version of webkit. Not all the newest SVG features may be supported.) 

#### Structure ####

The only restriction of the file is that it has to conform to a certain layer structure (the names of the layers matter, except when noted. All layers except the toplevel are optional.):

* *main* (name does not matter, but there needs to be a toplevel layer, containing all the other layers)
  - *symbols* (a "scratch" layer; will not be displayed by the application)
  - *background* (should contain stuff that will always be visible)
  - *Vacuum* (can be any name, can be show/hidden by the user)
  - *Stuff* (same)
  - ...

Further, each of the layers can optionally have sublayers of the names "zoom0", "zoom1", and so on. These will be used at different detail levels depending on user navigation. Things drawn outside of these sublayers are shown in every zoom level of the layer.

- Stuff
  + zoom0  (a general overview, that is shown when the app is started)
  + zoom1  (more detailed view of the parts)
  + zoom3  (super detailed view with individual equipment, etc)

The scales where the different zoom levels will become active can be tweaked through a configuration option, see below.

#### Models ####

In order to connect your drawing to TANGO, you need to insert references to devices or attributes. This is done through the "desc" SVG element which can be inserted into most SVG elements. 

A desc element containing a text like "model=sys/tg_test/1" will connect the container element to the test device. This means that the element will be colored ("fill") according to the State of the device, and also that left clicking the element will by default open the device using a Taurus device panel. The click behavior can be overridden by python code.

Adding an attribute as a model (e.g. "model=sys/tg_test/1/ampli") to a text element will instead cause it to display the current value of the element. If the "State" attribute is given, the fill color will also be set accordingly.

It's also possible to name a part of the drawing as a "section" by setting a desc like "section=MySection". This part will then become clickable, causing the view to zoom in on it.


#### Tips & tricks ####

The SVG format has lots of features that can be useful for a synoptic. There are no particular restrictions to what features can be used, except for what's actually supported by the browser component used. Since it's an evolving standard, some newer features may not be supported by the Qt webkit widget so it's important to test that before relying on it.

Inkscape is a very powerful tool and it's worth putting a little time into learning to use it effectively. It has many helpful features that may not be immediately obvious. 

##### Groups #####
It's often practical to group elements together to form more complex shapes. You can set the model on a group as usual. Groups can also be cloned. Note that the State color will only affect parts of the group that do not have inline fill styles (see "Troubleshooting" below). This effect can be used to e.g. make an icon that contains a lamp that is colored according to state. 

##### Clones #####
Usually a synoptic will contain a few different symbols that are reused several times, e.g. vacuum valves, pumps, etc. This can be quite tedious since you have to copy-paste each symbol everywhere every time you change its appearance. The "clone" functionality in inkscape allows you to create one "master" instance of each symbol (element or group) and then create clones of it to use in the drawing. 
    - Clones can't be edited, but changes made to the original are reflected by all clones. If the original is a group, you can edit it by double clicking it. It will then be entered (like a layer) and you can edit the contents.
    - The model can be set individually on each clone. 
    - The original can be kept in the "symbols" layer (see above) so it's not visible.
    - To check that your element is a clone, select it and check the bottom of the window, where it should say "Clone of: ...". 
    - Clones can safely be duplicated (Ctrl+d) into new clones. 
    - Avoid clones of clones, as this can cause unexpected behaviors.

##### Alignment #####
Inkscape has lots of tools that make it easier to make drawings neat. The "snap" feature helps a lot with placement of elements, especially together with the "grid" and "guide" features. The "Align and distribute" panel also helps with spacing and lining up of elements. Holding the Control key when moving or rotating things is also helpful. Check inkscape's documentation for more information.

##### Scaling #####
Be careful about scaling elements, as it can easily make things look "off". This is especially true about text, and rotated elements. Holding down Control while scaling makes sure the width/height ratio is kept intact. Also, inkscape can be configured to keep line thickness constant when scaling. If you mess up the scaling of some object, it can be reset from inkscape through "Object"->"Transform..."->"Matrix", by checking the "Edit current matrix" box and clearing it. However this will also reset the position of your element, so if it's a clone it will be positioned on the original.


#### Troubleshooting ####

A generally useful tool to check issues is the "XML Editor" in inkscape. It can be used to inspect the resulting SVG file directly.

##### items do not display state colors correctly #####

First, check that your model definition is correct. Then, check that the "fill" style is not set in the element's "style" attribute. Unsetting fill can be done by clicking the "?" button in the "Fill and Stroke" dialog. If it's a group, also check the elements in the group. An object with no inline fill should appear completely black in Inkscape.

The synoptic uses CSS classes to set the fill style, and that can be overridden by "inline" styles directly on the element. Inkscape uses inline styles to set fill, so it's quite likely to be an issue. 


## The HTML file ##

Not too much to do in this file, but there are some settings for the synoptic that can be tweaked, and some functionality ("plugins") of the synoptic selectively loaded. Have a look at the HTML files in the examples to see how this is done. 

Also, any background or foreground images, styling etc, should be done here. If more complex styling is required, separate CSS files may be loaded from here. Note that SVG can also be styled by CSS.

### Zoom levels ###

By default there is assumed to be three zoom levels, at 1, 10 and 100 times each. This means that the first level (0) is only shown when the synoptic is maximally zoomed out, the next (1) is shown until it's zoomed in to 10 times enlargement, and finally, the last level (2) is shown up to a zoom factor 100, which is also the maximum allowed zoom.

Let's say you have two zoom levels, and you want to switch between them at zoom factor 2 and allow sooming up to a factor 10. The config should then look like this:

    {view: {zoomSteps: [2, 10]}}


## Issues and limitations ##

Some things to be aware of:

* Currently, having SVG "transform" attributes on a *layer* causes all sorts of issues where models are not recognized as in view. Make sure the "transform" attribute is not set on any of your layers (most easily done through the XML editor in inkscape). It's quite easy to add this by mistake in inkscape, by selecting all elements in a layer and moving them at the same time. This will hopefully be handled better by a future version of SVG synoptic.
