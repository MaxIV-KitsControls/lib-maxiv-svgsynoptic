import os

from taurus.external.qt import Qt

from svgsynoptic.synopticwidget import SynopticWidget


def main():
    qapp = Qt.QApplication([])


    # We need to give the absolute path to the HTML file
    # because our webview is setup to load assets from the
    # svgsynoptic library's path, not from the module's path.
    path = os.path.dirname(__file__)
    widget = SynopticWidget(os.path.join(path, "example1.html"))
    # widget.setModel(

    widget.show()
    qapp.exec_()


if __name__ == "__main__":
    main()
