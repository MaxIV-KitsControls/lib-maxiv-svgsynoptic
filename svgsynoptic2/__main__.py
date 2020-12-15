"""
A simple commandline way to test a synoptic file
"""

import json
import os
import sys
from optparse import OptionParser
from string import Template
from tempfile import NamedTemporaryFile

from taurus.qt.qtgui.application import TaurusApplication

from svgsynoptic2.taurussynopticwidget import TaurusSynopticWidget


def main():

    parser = OptionParser("usage: %prog [options] SVGFILE")
    parser.add_option("-s", "--size", dest="size",
                      help="Window size on form WIDTH,HEIGHT", metavar="WINSIZE")
    parser.add_option("-t", "--title", dest="title",
                      help="Window title", metavar="WINTITLE")
    parser.add_option("-z", "--zoomsteps", dest="zoomsteps", metavar="ZOOMSTEPS",
                      help="Zoom levels, on form ZOOM1,ZOOM2,...", default="1")

    app = TaurusApplication(cmd_line_parser=parser)

    args = app.get_command_line_args()
    if len(args) != 1:
        sys.exit("You need to specify the SVG file to load!")
    svg = args[0]
    options = app.get_command_line_options()

    widget = TaurusSynopticWidget()

    # We'd like the synoptic to "select" the relevant item when
    # the user focuses on a panel. Let's connect a handler to
    # the focusChanged signal that does this.
    def onfocus(old, new):
        if new and hasattr(new, "window"):
            for device, panel in widget._panels.items():
                if panel == new.window():
                    widget.select("model", [device])
    app.focusChanged.connect(onfocus)

    # need absolute path to the SVG file
    svgfile = os.path.abspath(svg)

    # since the svg currently needs to be hardcoded in the HTML, we
    # create a temporary HTML file from a static template.
    path = os.path.dirname(__file__)
    template = os.path.join(path, "web", "template.html")
    with open(template) as f:
        tmpl = Template(f.read())
    zoomsteps = [int(z) for z in options.zoomsteps.split(",")]
    config = {"view": {"zoomSteps": zoomsteps}}
    html = tmpl.substitute(path="/web", svgfile=svgfile, config=json.dumps(config))
    with NamedTemporaryFile(suffix=".html") as tf:
        tf.write(html)
        tf.flush()
        widget.setModel(tf.name)
        if options.size:
            w, h = options.size.split(",")
            widget.resize(int(w), int(h))

        widget.setWindowTitle(options.title or os.path.basename(svg))
        widget.show()
        app.exec_()


if __name__ == "__main__":
    main()
