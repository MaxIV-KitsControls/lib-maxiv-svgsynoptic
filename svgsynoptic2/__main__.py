"""A simple commandline way to test a synoptic file"""

import os
from string import Template
import sys
from tempfile import NamedTemporaryFile

from taurus.qt.qtgui.application import TaurusApplication
from svgsynoptic2.taurussynopticwidget import TaurusSynopticWidget


def main():

    app = TaurusApplication()
    widget = TaurusSynopticWidget()

    # We'd like the synoptic to "select" the relevant item when
    # the user focuses on a panel. Let's connect a handler to
    # the focusChanged signal that does this.
    def onFocus(old, new):
        if new and hasattr(new, "window"):
            for device, panel in widget._panels.items():
                if panel == new.window():
                    widget.select("model", [device])

    app.focusChanged.connect(onFocus)

    # need absolute path to the SVG file
    svgfile = os.path.abspath(sys.argv[1])

    # since the svg currently needs to be hardcoded in the HTML, we
    # create a temporary HTML file from a static template.
    path = os.path.dirname(__file__)
    template = os.path.join(path, "web", "template.html")
    with open(template) as f:
        tmpl = Template(f.read())
    html = tmpl.substitute(path="/web", svgfile=svgfile, config="{}")
    with NamedTemporaryFile(suffix=".html") as tf:
        tf.write(html)
        tf.flush()
        widget.setModel(tf.name)
        widget.show()
        widget.setWindowTitle(sys.argv[1])
        app.exec_()


if __name__ == "__main__":
    main()
