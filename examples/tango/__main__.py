"""
A simple example that shows how to use the SVG synoptic widget
in a stand alone application.
"""

import os

from taurus.external.qt import Qt
from taurus.qt.qtgui.panel import TaurusDevicePanel

from svgsynoptic2.taurussynopticwidget import TaurusSynopticWidget


class ExampleSynopticWidget(TaurusSynopticWidget):

    "A custom subclass of the synoptic widget."

    def get_device_panel(self, device):
        return TaurusDevicePanel


def main():
    qapp = Qt.QApplication([])

    # We need to give the absolute path to the HTML file
    # because our webview is setup to load assets from the
    # svgsynoptic library's path, not from the module's path.
    path = os.path.dirname(__file__)
    widget = ExampleSynopticWidget()
    widget.setModel(os.path.join(path, "example.html"))
    widget.resize(1000, 700)
    widget.show()
    qapp.exec_()


if __name__ == "__main__":
    main()
