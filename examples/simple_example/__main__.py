"""
A simple example that shows how to use the SVG synoptic widget
in a stand alone application.
"""

import os


from taurus.qt.qtgui.application import TaurusApplication

from svgsynoptic2.synopticwidget import SynopticWidget


class ExampleSynopticWidget(SynopticWidget):

    """
    A custom subclass of the synoptic widget.
    """

    _modelNames = None

    def on_click(self, kind, name):
        # Overriding the click event handler to print information
        print("click", kind, name)


def main():
    qapp = TaurusApplication()

    # We need to give the absolute path to the HTML file
    # because our webview is setup to load assets from the
    # svgsynoptic library's path, not from the module's path.
    path = os.path.dirname(__file__)
    widget = ExampleSynopticWidget(os.path.join(path, "example1.html"))
    widget.resize(800, 600)

    widget.show()
    qapp.exec_()


if __name__ == "__main__":
    main()
