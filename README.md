# SVG synoptic #


## Important ##

This is a rewrite of the SVG synoptic library
(https://github.com/johanfforsberg/taurus-svgsynoptic) intended to
generalize and clean things up. It is mostly complete, but is not
deployed anywhere yet so should not be considered finished. Some
important details of how it works have changed, and it is not
immediately compatible with SVG files from old versions (although the
changes should be easy to automate).  Updated documentation will
follow shortly.


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

To make a very simple synoptic application, all you need to do is copy the structure of one of the demo applications, create a SVG file of the correct structure, and modify "index.html" to suit your needs. 

### The SVG file ###

This is really the most important part of any synoptic application. It can in principle contain anything that is supported by SVG (caveat: the application currently uses the Qt4 webview widget to display the SVG, which is based on a slightly older version of webkit. Not all the newest SVG features may be supported.) 

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

## The HTML file ##

Not too much to do in this file, but there are some settings for the synoptic that can be tweaked, and some functionality ("plugins") of the synoptic selectively loaded. 

Also, any background or foreground images, styling etc, should be done here. If more complex styling is required, separate CSS files may be loaded from here. Note that SVG can also be styled by CSS.


## Issues and limitations ##

Some things to be aware of:

* Currently, having SVG "transform" attributes on a *layer* causes all sorts of issues where models are not recognized as in view. Make sure the transform attribute is not set on any of your layers. It's quite easy to add this by mistake in inkscape, by selecting all elements in a layer and moving them at the same time. This will hopefully be handled better by a future version of SVG synoptic.
